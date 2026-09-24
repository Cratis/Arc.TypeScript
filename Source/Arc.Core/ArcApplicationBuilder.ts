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

/** Collect decorated artifacts and their services into one executable application. */
export class ArcApplicationBuilder {
    readonly services = new ArcApplicationServices();
    readonly #artifacts: Artifact[] = [];
    readonly #responseHandlers: ServiceIdentifier<CommandResponseValueHandler>[] = [];
    readonly #valueProviders: ServiceIdentifier<CommandContextValuesProvider>[] = [];
    readonly #keyResolvers: ServiceIdentifier<CommandKeyResolver>[] = [];
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
    /** Add explicitly named decorated artifacts; reject undecorated classes. */
    add(...types: ClassType[]): this {
        for (const type of types) {
            const metadata = ownMetadata(type);
            if (!metadata.command && !metadata.readModel && !metadata.lifetime && !metadata.validatorTarget && !metadata.responseValueHandler) {
                throw new Error(`Not an Arc artifact: ${type.name}`);
            }
            this.register(type, metadata.namespace ?? '');
        }
        return this;
    }
    private register(type: ClassType, namespace: string): void {
        const metadata = ownMetadata(type);
        if (!metadata.command && !metadata.readModel && !metadata.lifetime && !metadata.validatorTarget && !metadata.responseValueHandler) return;
        const effective = metadata.namespace ?? namespace;
        const previous = this.#namespaces.get(type);
        if (previous !== undefined && previous !== effective) {
            throw new Error(`Conflicting namespaces for ${type.name}: ${previous} and ${effective}`);
        }
        if (previous !== undefined) return;
        this.#namespaces.set(type, effective);
        this.#artifacts.push({ type, namespace: effective });
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
        dependencies.push(...this.#responseHandlers, ...this.#valueProviders, ...this.#keyResolvers,
            ...this.options.commandResponseValueHandlers ?? [], ...this.options.commandContextValuesProviders ?? [],
            ...this.options.commandKeyResolvers ?? []);
        if (this.options.services && !Array.isArray(this.options.services) && this.services.registrations.length)
            throw new Error('A supplied ServiceRegistry cannot be combined with builder service registrations');
        const registrations = [...Array.isArray(this.options.services) ? this.options.services : [], ...this.services.registrations];
        const server = new ArcServer({ ...this.options, commands, queries, observableQueries,
            commandResponseValueHandlers: [...this.options.commandResponseValueHandlers ?? [], ...this.#responseHandlers],
            commandContextValuesProviders: [...this.options.commandContextValuesProviders ?? [], ...this.#valueProviders],
            commandKeyResolvers: [...this.options.commandKeyResolvers ?? [], ...this.#keyResolvers],
            services: this.options.services && !Array.isArray(this.options.services) ? this.options.services : registrations });
        try { await this.preflight(server, dependencies, validatorTypes); }
        catch (error) { await server.dispose(); throw error; }
        return new ArcApplication(server);
    }
    private checkServiceOwnership(): void {
        if (this.options.services && !Array.isArray(this.options.services) &&
            (this.services.registrations.length || this.#artifacts.some(({ type }) => {
                const metadata = ownMetadata(type);
                return metadata.lifetime || metadata.validatorTarget || metadata.responseValueHandler;
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
        server.services.preflight(dependencies);
        const scope = server.services.createScope({ correlationId: '', principal: undefined, tenantId: undefined,
            signal: new AbortController().signal, allowedSeverity: Severity.Error });
        try {
            for (const type of validators.values()) {
                const validator = await scope.resolve(type);
                if (!(validator instanceof BaseValidator)) throw new Error(`Invalid validator: ${type.name}`);
            }
        } finally { await scope.dispose(); }
    }
}
