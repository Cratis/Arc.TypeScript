// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { realpath } from 'node:fs/promises';
import { dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { z } from 'zod';
import type { ArcServerOptions } from './ArcServerOptions.js';
import { ArcApplicationServices } from './ArcApplicationServices.js';
import { ArcApplication } from './ArcApplication.js';
import { ArcServer } from './ArcServer.js';
import type { CommandDefinition } from './commands/CommandDefinition.js';
import type { QueryDefinition } from './queries/QueryDefinition.js';
import type { ObservableQueryDefinition } from './queries/observable/ObservableQueryDefinition.js';
import { compileCommand } from './commands/modelBound/compileCommand.js';
import { compileQueries } from './queries/modelBound/compileQueries.js';
import { ownMetadata } from './reflection/ownMetadata.js';
import type { ClassType } from './reflection/ClassType.js';
import type { Artifact } from './reflection/Artifact.js';
import { validateMetadata } from './reflection/validateMetadata.js';
import { ensureDiscoveryRootSafe } from './reflection/ensureDiscoveryRootSafe.js';
import { discoveryFiles } from './reflection/discoveryFiles.js';
import type { ServiceIdentifier } from './dependencyInjection/ServiceIdentifier.js';
import { Severity } from './validation/Severity.js';
import { BaseValidator } from './validation/BaseValidator.js';
import { ModelGraphValidator } from './validation/ModelGraphValidator.js';
import type { CommandResponseValueHandler } from './commands/CommandResponseValueHandler.js';
import type { CommandContextValuesProvider } from './commands/CommandContextValuesProvider.js';
import type { CommandKeyResolver } from './commands/CommandKeyResolver.js';
import type { QueryRenderer } from './queries/QueryRenderer.js';
import type { ReadModelInterceptor } from './queries/ReadModelInterceptor.js';
import type { ReadModelForCommandResolver } from './commands/ReadModelForCommandResolver.js';
import { readModelArgument } from './commands/modelBound/readModel.js';
import type { CommandContext } from './commands/CommandContext.js';
import type { CommandResult } from './commands/CommandResult.js';
import type { AuthorizationPolicy, AuthorizationPolicyRegistration } from './authorization/AuthorizationPolicy.js';
import { isIdentityDetailsProvider } from './identity/discoverIdentityDetails.js';
import type { IdentityDetailsProvider } from './identity/IdentityDetailsProvider.js';

/** Collect decorated artifacts and their services into one executable application. */
export class ArcApplicationBuilder {
    readonly services = new ArcApplicationServices();
    readonly #artifacts: Artifact[] = [];
    readonly #responseHandlers: ServiceIdentifier<CommandResponseValueHandler>[] = [];
    readonly #valueProviders: ServiceIdentifier<CommandContextValuesProvider>[] = [];
    readonly #keyResolvers: ServiceIdentifier<CommandKeyResolver>[] = [];
    readonly #queryRenderers: ServiceIdentifier<QueryRenderer>[] = [];
    readonly #readModelInterceptors: ServiceIdentifier<ReadModelInterceptor>[] = [];
    readonly #readModelResolvers: ServiceIdentifier<ReadModelForCommandResolver>[] = [];
    readonly #artifactObservers: ((type: ClassType) => boolean)[] = [];
    readonly #commandRunners: ((context: CommandContext, execute: () => Promise<CommandResult>) => Promise<CommandResult>)[] = [];
    readonly #policies = new Map<string, AuthorizationPolicyRegistration>();
    readonly #identityProviders: ClassType[] = [];
    #built = false;
    readonly #namespaces = new Map<ClassType, string>();
    constructor(private readonly options: ArcServerOptions = {}) {}
    /** Add an ordered scoped response handler registered in services. */
    addCommandResponseValueHandler(token: ServiceIdentifier<CommandResponseValueHandler>): this {
        this.#responseHandlers.push(token);
        return this;
    }
    /** Add an ordered scoped context value provider registered in services. */
    addCommandContextValuesProvider(token: ServiceIdentifier<CommandContextValuesProvider>): this {
        this.#valueProviders.push(token);
        return this;
    }
    /** Add a key resolver before the built-in @key/getKey resolver. */
    addCommandKeyResolver(token: ServiceIdentifier<CommandKeyResolver>): this {
        this.#keyResolvers.push(token);
        return this;
    }
    /** Add an ordered scoped query renderer registered in services. */
    addQueryRenderer(token: ServiceIdentifier<QueryRenderer>): this { this.#queryRenderers.push(token); return this; }
    /** Add an ordered scoped read-model interceptor registered in services. */
    addReadModelInterceptor(token: ServiceIdentifier<ReadModelInterceptor>): this { this.#readModelInterceptors.push(token); return this; }
    /** Add a source for command-keyed read models (Chronicle, MongoDB, or an application source). */
    addReadModelForCommandResolver(token: ServiceIdentifier<ReadModelForCommandResolver>): this {
        this.#readModelResolvers.push(token);
        return this;
    }
    /** Admit and observe integration-owned artifacts alongside Arc's own artifacts. */
    addArtifactObserver(observer: (type: ClassType) => boolean): this {
        this.#artifactObservers.push(observer);
        return this;
    }
    /** Wrap validated command execution in an ordered asynchronous context. */
    addCommandExecutionRunner(runner: (context: CommandContext, execute: () => Promise<CommandResult>) => Promise<CommandResult>): this {
        this.#commandRunners.push(runner);
        return this;
    }
    /** Register a unique named authorization policy before building the application. */
    addAuthorizationPolicy(name: string, policy: AuthorizationPolicyRegistration): this {
        if (!name.trim() || typeof policy !== 'function' || this.#policies.has(name) ||
            Object.hasOwn(this.options.authorizationPolicies ?? {}, name)) throw new Error(`Invalid or duplicate authorization policy: ${name}`);
        if (policy.prototype && typeof policy.prototype.authorize === 'function') {
            const type = policy as (abstract new (...arguments_: never[]) => AuthorizationPolicy);
            const registrations = [...Array.isArray(this.options.services) ? this.options.services : [], ...this.services.registrations];
            const existing = registrations.find(registration => registration.token === type);
            if (existing && existing.lifetime !== 'scoped')
                throw new Error(`Authorization policy ${name} must be scoped`);
            if (!existing) this.services.addScoped(type);
        }
        this.#policies.set(name, policy);
        return this;
    }
    /** Add explicitly named decorated artifacts; reject undecorated classes. */
    add(...types: ClassType[]): this {
        for (const type of types) {
            const metadata = ownMetadata(type);
            if (!this.register(type, metadata.namespace ?? '')) throw new Error(`Not an Arc artifact: ${type.name}`);
        }
        return this;
    }
    private register(type: ClassType, namespace: string): boolean {
        let external = false;
        for (const observer of this.#artifactObservers) if (observer(type)) external = true;
        const metadata = ownMetadata(type);
        if (isIdentityDetailsProvider(type)) {
            if (!this.#identityProviders.includes(type)) this.#identityProviders.push(type);
            return true;
        }
        if (!metadata.command && !metadata.readModel && !metadata.lifetime && !metadata.validatorTarget && !metadata.responseValueHandler && !metadata.queryRenderer && !metadata.readModelInterceptor) return external;
        const effective = metadata.namespace ?? namespace;
        const previous = this.#namespaces.get(type);
        if (previous !== undefined && previous !== effective) {
            throw new Error(`Conflicting namespaces for ${type.name}: ${previous} and ${effective}`);
        }
        if (previous !== undefined) return true;
        this.#namespaces.set(type, effective);
        this.#artifacts.push({ type, namespace: effective });
        return true;
    }
    /** Import decorated artifacts beneath a dedicated discovery root. */
    async discover(root: URL, options: { rootNamespace?: string } = {}): Promise<this> {
        if (root.protocol !== 'file:') throw new Error('Arc discovery requires a file URL');
        const folder = await realpath(fileURLToPath(root));
        await ensureDiscoveryRootSafe(folder);
        for (const file of discoveryFiles(folder)) {
            const module: Record<string, unknown> = await import(pathToFileURL(file).href);
            const namespace = [options.rootNamespace, ...relative(folder, dirname(file)).split(sep)
                .filter(value => value && value !== '.')].filter(Boolean).join('.');
            for (const exported of Object.values(module)) {
                if (typeof exported === 'function') this.register(exported as ClassType, namespace);
            }
        }
        return this;
    }
    /** Compile artifacts and preflight their declared dependencies. */
    async build(): Promise<ArcApplication> {
        if (this.#built) throw new Error('Arc application builder can be built only once');
        this.#built = true;
        this.checkServiceOwnership();
        const dependencies: ServiceIdentifier<unknown>[] = [];
        const validatorTypes = this.registerValidators(dependencies);
        const graph = new ModelGraphValidator(validatorTypes, this.options.logger);
        const commands: CommandDefinition<z.ZodType, unknown>[] = [...this.options.commands ?? []];
        const queries: QueryDefinition<z.ZodType, unknown>[] = [...this.options.queries ?? []];
        const observableQueries: ObservableQueryDefinition<z.ZodType, unknown>[] = [...this.options.observableQueries ?? []];
        this.compileArtifacts(graph, dependencies, commands, queries, observableQueries);
        dependencies.push(...this.#responseHandlers, ...this.#valueProviders, ...this.#keyResolvers, ...this.#readModelResolvers,
            ...this.options.readModelForCommandResolvers ?? [],
            ...this.options.commandResponseValueHandlers ?? [], ...this.options.commandContextValuesProviders ?? [],
            ...this.options.commandKeyResolvers ?? [], ...this.#queryRenderers, ...this.#readModelInterceptors,
            ...this.options.queryRenderers ?? [], ...this.options.readModelInterceptors ?? []);
        if (this.options.services && !Array.isArray(this.options.services) && this.services.registrations.length)
            throw new Error('A supplied ServiceRegistry cannot be combined with builder service registrations');
        const registrations = [...Array.isArray(this.options.services) ? this.options.services : [], ...this.services.registrations];
        if (this.options.identityDetails && this.#identityProviders.length)
            throw new Error('Explicit and discovered identity details providers cannot be combined');
        if (!this.options.identityDetails && this.#identityProviders.length > 1)
            throw new Error(`Multiple identity details providers found: ${this.#identityProviders.map(type => type.name).join(', ')}`);
        const providerType = this.#identityProviders[0];
        const instance = !this.options.identityDetails && providerType ? Reflect.construct(providerType, []) as IdentityDetailsProvider : undefined;
        const discovered: IdentityDetailsProvider | undefined = instance && providerType ? {
            schema: instance.schema, detailsType: instance.detailsType,
            provide: (principal, context) => (Reflect.construct(providerType, []) as IdentityDetailsProvider).provide(principal, context)
        } : undefined;
        const runners = [...this.options.commandExecutionRunner ? [this.options.commandExecutionRunner] : [], ...this.#commandRunners];
        const commandExecutionRunner = runners.length ? (context: CommandContext, execute: () => Promise<CommandResult>) =>
            runners.reduceRight<() => Promise<CommandResult>>((next, runner) => () => runner(context, next), execute)() : undefined;
        const server = new ArcServer({ ...this.options, commands, queries, observableQueries, commandExecutionRunner,
            identityDetails: this.options.identityDetails ?? discovered,
            authorizationPolicies: { ...this.options.authorizationPolicies, ...Object.fromEntries(this.#policies) },
            commandResponseValueHandlers: [...this.options.commandResponseValueHandlers ?? [], ...this.#responseHandlers],
            commandContextValuesProviders: [...this.options.commandContextValuesProviders ?? [], ...this.#valueProviders],
            commandKeyResolvers: [...this.options.commandKeyResolvers ?? [], ...this.#keyResolvers],
            queryRenderers: [...this.options.queryRenderers ?? [], ...this.#queryRenderers],
            readModelInterceptors: [...this.options.readModelInterceptors ?? [], ...this.#readModelInterceptors],
            readModelForCommandResolvers: [...this.options.readModelForCommandResolvers ?? [], ...this.#readModelResolvers],
            services: this.options.services && !Array.isArray(this.options.services) ? this.options.services : registrations });
        try { await this.preflight(server, dependencies, validatorTypes); }
        catch (error) { await server.dispose(); throw error; }
        return new ArcApplication(server);
    }
    private checkServiceOwnership(): void {
        if (this.options.services && !Array.isArray(this.options.services) &&
            (this.services.registrations.length || this.#artifacts.some(({ type }) => {
                const metadata = ownMetadata(type);
                return metadata.lifetime || metadata.validatorTarget || metadata.responseValueHandler ||
                    metadata.queryRenderer || metadata.readModelInterceptor;
            }))) throw new Error('Decorated lifetimes and builder registrations require builder-owned services');
    }
    private registerValidators(dependencies: ServiceIdentifier<unknown>[]): Map<ClassType, ClassType<BaseValidator<unknown>>> {
        const validatorTypes = new Map<ClassType, ClassType<BaseValidator<unknown>>>();
        for (const { type } of this.#artifacts) {
            validateMetadata(type);
            const target = ownMetadata(type).validatorTarget;
            if (!target) continue;
            if (validatorTypes.has(target)) throw new Error(`Duplicate validator target: ${target.name}`);
            validatorTypes.set(target, type as ClassType<BaseValidator<unknown>>);
            const lifetime = ownMetadata(type).lifetime;
            if (lifetime === 'singleton') throw new Error(`Validator ${type.name} must not be singleton`);
            const existing = [...Array.isArray(this.options.services) ? this.options.services : [], ...this.services.registrations]
                .find(registration => registration.token === type);
            if (existing?.lifetime === 'singleton') throw new Error(`Validator ${type.name} must not be singleton`);
            if (!existing) this.services[lifetime === 'scoped' ? 'addScoped' : 'addTransient'](type);
            dependencies.push(type);
        }
        return validatorTypes;
    }
    private compileArtifacts(graph: ModelGraphValidator, dependencies: ServiceIdentifier<unknown>[],
        commands: CommandDefinition<z.ZodType, unknown>[], queries: QueryDefinition<z.ZodType, unknown>[],
        observableQueries: ObservableQueryDefinition<z.ZodType, unknown>[]): void {
        for (const { type, namespace } of this.#artifacts) {
            const metadata = ownMetadata(type);
            if (metadata.queryRenderer || metadata.readModelInterceptor) {
                if (metadata.command || metadata.readModel || metadata.validatorTarget || metadata.responseValueHandler ||
                    metadata.queryRenderer && metadata.readModelInterceptor || metadata.lifetime === 'singleton')
                    throw new Error(`Conflicting Arc query extension artifact: ${type.name}`);
                if (metadata.queryRenderer) {
                    if (typeof type.prototype.canRender !== 'function' || typeof type.prototype.render !== 'function')
                        throw new Error(`Query renderer ${type.name} requires canRender() and render()`);
                    this.#queryRenderers.push(type as ServiceIdentifier<QueryRenderer>);
                } else {
                    if (typeof type.prototype.intercept !== 'function')
                        throw new Error(`Read-model interceptor ${type.name} requires intercept()`);
                    this.#readModelInterceptors.push(type as ServiceIdentifier<ReadModelInterceptor>);
                }
                if (!metadata.lifetime) this.services.addScoped(type);
            }
            if (metadata.responseValueHandler) {
                if (metadata.command || metadata.readModel || metadata.validatorTarget)
                    throw new Error(`Conflicting Arc response handler artifact: ${type.name}`);
                if (typeof type.prototype.canHandle !== 'function' || typeof type.prototype.handle !== 'function')
                    throw new Error(`Response handler ${type.name} requires canHandle() and handle()`);
                this.#responseHandlers.push(type as ServiceIdentifier<CommandResponseValueHandler>);
                if (!metadata.lifetime) this.services.addScoped(type);
            }
            if (metadata.lifetime && !metadata.validatorTarget) {
                const registration = metadata.lifetime === 'singleton' ? 'addSingleton' :
                    metadata.lifetime === 'scoped' ? 'addScoped' : 'addTransient';
                this.services[registration](type);
            }
            if (metadata.command) {
                const compiled = compileCommand(type, namespace, graph);
                commands.push(compiled.definition);
                dependencies.push(...compiled.dependencies);
            }
            if (metadata.readModel) for (const compiled of compileQueries(type, namespace, graph)) {
                if (compiled.observable) observableQueries.push(compiled.definition as ObservableQueryDefinition<z.ZodType, unknown>);
                else queries.push(compiled.definition as QueryDefinition<z.ZodType, unknown>);
                dependencies.push(...compiled.dependencies);
            }
        }
    }
    private async preflight(server: ArcServer, dependencies: ServiceIdentifier<unknown>[],
        validators: ReadonlyMap<ClassType, ClassType<BaseValidator<unknown>>>): Promise<void> {
        server.services.preflight([...dependencies, ...[...this.#policies.values()].filter(
            (policy): policy is (abstract new (...arguments_: never[]) => AuthorizationPolicy) =>
                typeof policy.prototype?.authorize === 'function')]);
        const scope = server.services.createScope({ correlationId: '', principal: undefined, tenantId: undefined,
            signal: new AbortController().signal, allowedSeverity: Severity.Error });
        try {
            const resolvers = await Promise.all([...this.options.readModelForCommandResolvers ?? [], ...this.#readModelResolvers]
                .map(token => scope.resolve(token)));
            for (const { type } of this.#artifacts) {
                const bindings = ownMetadata(type).injected;
                for (const token of [...bindings?.get('provide') ?? [], ...bindings?.get('handle') ?? []]) {
                    const model = readModelArgument(token);
                    if (!model) continue;
                    const matching = resolvers.filter(resolver => resolver.supports(model.type));
                    if (matching.length !== 1) throw new Error(`Expected one read-model resolver for ${model.type.name}, found ${matching.length}`);
                }
            }
            for (const type of validators.values()) {
                const validator = await scope.resolve(type);
                if (!(validator instanceof BaseValidator)) throw new Error(`Invalid validator: ${type.name}`);
            }
        } finally { await scope.dispose(); }
    }
}
