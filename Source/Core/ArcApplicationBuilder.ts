// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcOptions } from './ArcOptions.js';
import type { ArcBuilderExtensions } from './fetch.js';
import type { CratisConfiguration } from './configuration/loadConfiguration.js';
import { ArcApplicationServices } from './dependencyInjection/ArcApplicationServices.js';
import type { FetchArcApplication } from './FetchArcApplication.js';
import { ArcServer } from './ArcServer.js';
import { buildRegistered } from './build/buildRegistered.js';
import { ownMetadata } from './reflection/ownMetadata.js';
import { registerGeneratedMetadata, withGeneratedMetadata } from './reflection/registerGeneratedMetadata.js';
import type { ArtifactMetadata } from './reflection/ArtifactMetadata.js';
import type { GeneratedMetadata } from './reflection/GeneratedArtifactMetadata.js';
import type { ClassType } from './reflection/ClassType.js';
import type { Artifact } from './reflection/Artifact.js';
import type { ServiceIdentifier } from './dependencyInjection/ServiceIdentifier.js';
import type { CommandResponseValueHandler } from './commands/CommandResponseValueHandler.js';
import type { CommandContextValuesProvider } from './commands/CommandContextValuesProvider.js';
import type { CommandKeyResolver } from './commands/CommandKeyResolver.js';
import type { QueryRenderer } from './queries/QueryRenderer.js';
import type { ReadModelInterceptor } from './queries/ReadModelInterceptor.js';
import type { ReadModelForCommandResolver } from './commands/ReadModelForCommandResolver.js';
import type { CommandContext } from './commands/CommandContext.js';
import type { CommandResult } from './commands/CommandResult.js';
import type { CommandExecutionScope } from './commands/CommandExecutionScope.js';
import type { AuthorizationPolicy, AuthorizationPolicyRegistration } from './authorization/AuthorizationPolicy.js';
import { isIdentityDetailsProvider } from './identity/discoverIdentityDetails.js';

/** Collect decorated artifacts and their services into one executable application. */
// Interface merging exposes integration-owned methods without depending on optional packages in core.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface ArcApplicationBuilder extends ArcBuilderExtensions {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
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
    readonly #commandScopes: (() => CommandExecutionScope)[] = [];
    readonly #builtObservers: ((server: ArcServer) => void)[] = [];
    readonly #policies = new Map<string, AuthorizationPolicyRegistration>();
    readonly #identityProviders: ClassType[] = [];
    #built = false;
    readonly #namespaces = new Map<ClassType, string>();
    protected generatedMetadata?: ReadonlyMap<ClassType, ArtifactMetadata>;
    constructor(private readonly options: ArcOptions = {}, readonly configuration: CratisConfiguration = {}) {}
    /** Install an optional integration registered by its explicit package import. */
    extend<T>(name: string, options: T): this {
        const extension = ArcApplicationBuilder.extensions().get(name);
        if (!extension) throw new Error(`Import @cratis/arc.${name} before calling with${name[0]!.toUpperCase()}${name.slice(1)}()`);
        extension(this, options);
        return this;
    }
    /** Register an integration across independently loaded copies of the core package. */
    static registerExtension<T, TBuilder extends ArcApplicationBuilder>(name: string, install: (builder: TBuilder, options: T) => void): void {
        const registry = this.extensions();
        const existing = registry.get(name);
        if (existing === install) return;
        if (existing) throw new Error(`Conflicting Arc integration registration: ${name}`);
        registry.set(name, install as unknown as (builder: ArcApplicationBuilder, options: unknown) => void);
    }
    private static extensions(): Map<string, (builder: ArcApplicationBuilder, options: unknown) => void> {
        const key = Symbol.for('cratis.arc.builder.extensions');
        const global = globalThis as typeof globalThis & { [key: symbol]: unknown };
        if (!global[key]) global[key] = new Map<string, (builder: ArcApplicationBuilder, options: unknown) => void>();
        return global[key] as Map<string, (builder: ArcApplicationBuilder, options: unknown) => void>;
    }
    /** Install source-generated bindings before adding or discovering artifacts. */
    useGeneratedMetadata(metadata: GeneratedMetadata): this {
        if (this.#built || this.#artifacts.length) throw new Error('Register generated metadata before artifacts');
        this.generatedMetadata = registerGeneratedMetadata(metadata);
        return this;
    }
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
    /** Enroll an execution scope in every command, including decorated commands. */
    addCommandExecutionScope(create: () => CommandExecutionScope): this {
        this.#commandScopes.push(create);
        return this;
    }
    /** Bind integrations that need the compiled server before any client observations begin. */
    addBuiltObserver(observer: (server: ArcServer) => void): this {
        this.#builtObservers.push(observer);
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
        return withGeneratedMetadata(this.generatedMetadata, () => {
            for (const type of types) {
                const metadata = ownMetadata(type);
                if (!this.register(type, metadata.namespace ?? '')) throw new Error(`Not an Arc artifact: ${type.name}`);
            }
            return this;
        });
    }
    protected register(type: ClassType, namespace: string): boolean {
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
    /** File discovery is supported only by the Node entry. */
    async discover(_root: URL, _options?: { rootNamespace?: string }): Promise<this> {
        void _options;
        throw new Error('Arc discovery requires the Node application builder');
    }
    /** Compile artifacts and preflight their declared dependencies. */
    build(): Promise<FetchArcApplication> {
        return withGeneratedMetadata(this.generatedMetadata, () => this.buildRegistered());
    }
    private async buildRegistered(): Promise<FetchArcApplication> {
        if (this.#built) throw new Error('Arc application builder can be built only once');
        this.#built = true;
        return buildRegistered({ options: this.options, services: this.services, artifacts: this.#artifacts,
            responseHandlers: this.#responseHandlers, valueProviders: this.#valueProviders, keyResolvers: this.#keyResolvers,
            queryRenderers: this.#queryRenderers, readModelInterceptors: this.#readModelInterceptors,
            readModelResolvers: this.#readModelResolvers, commandRunners: this.#commandRunners, commandScopes: this.#commandScopes,
            builtObservers: this.#builtObservers, policies: this.#policies, identityProviders: this.#identityProviders,
            generatedMetadata: this.generatedMetadata });
    }
}
