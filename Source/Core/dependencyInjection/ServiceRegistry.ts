// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { ServiceRegistration } from './ServiceRegistration.js';
import type { ServiceToken } from './ServiceToken.js';
import { normalizeServiceToken, type ServiceIdentifier } from './ServiceIdentifier.js';
import { ServiceScope, closeServiceScope, createSingletonServiceScope, disposeCreatedServices, hasLivingServiceDisposal, hasLivingServiceResolution, serviceScopeRegistry, withServiceResolutionBoundary } from './ServiceScope.js';
import type { ServiceResolutionNode } from './ServiceResolutionNode.js';
import type { ServiceExecutionFrame } from './ServiceExecutionFrame.js';
import { ServiceDependencyError } from './ServiceDependencyError.js';
import { ServiceResolutionState } from './ServiceResolutionState.js';
import { ServiceExecutionState } from './ServiceExecutionState.js';
import { ServiceRegistryState } from './ServiceRegistryState.js';
import type { SingletonServiceContext } from './SingletonServiceContext.js';

/** Owns registrations and singleton instances. Dispose when the host shuts down. */
export class ServiceRegistry {
    readonly #registrations = new Map<symbol, ServiceRegistration<unknown>>();
    readonly #scopes = new Set<ServiceScope>();
    readonly #executions = new Set<Promise<void>>();
    readonly #activeExecution = new AsyncLocalStorage<ServiceExecutionFrame>();
    readonly #waits = new Map<ServiceResolutionNode, Map<ServiceResolutionNode, number>>();
    readonly #owners = new WeakMap<object, ServiceScope | null>();
    readonly #singletons: ServiceScope;
    readonly #lifetime = new AbortController();
    readonly #singletonContext: SingletonServiceContext = Object.freeze({ signal: this.#lifetime.signal });
    #state = ServiceRegistryState.Running;
    #singletonFailed = false;
    #closing: Promise<void> | undefined;

    constructor(registrations: readonly ServiceRegistration<unknown>[] = []) {
        for (const entry of registrations) {
            const token = normalizeServiceToken(entry.token);
            const registration = { ...entry, token, dependencies: entry.dependencies?.map(normalizeServiceToken) };
            if (!registration.token || typeof registration.token.key !== 'symbol' || typeof registration.token.name !== 'string')
                throw new ServiceDependencyError('Invalid service token');
            if (this.#registrations.has(registration.token.key)) throw new ServiceDependencyError(`Duplicate service: ${registration.token.name}`);
            if (!['singleton', 'scoped', 'transient'].includes(registration.lifetime) ||
                (registration.factory === undefined) === !Object.hasOwn(registration, 'instance') ||
                Object.hasOwn(registration, 'instance') && (registration.instance === undefined || registration.instance === null))
                throw new ServiceDependencyError(`Invalid service registration: ${registration.token.name}`);
            if (Object.hasOwn(registration, 'instance') && registration.lifetime !== 'singleton')
                throw new ServiceDependencyError(`Instance must be singleton: ${registration.token.name}`);
            if (Object.hasOwn(registration, 'instance') && (typeof registration.instance === 'object' || typeof registration.instance === 'function'))
                this.#owners.set(registration.instance as object, null);
            this.#registrations.set(registration.token.key, registration);
        }
        this.#singletons = createSingletonServiceScope(this);
    }
    get disposed(): boolean { return this.#state !== ServiceRegistryState.Running; }
    get singletonFailed(): boolean { return this.#singletonFailed; }
    /** @internal Registry-lifetime context for singleton factories. */
    get singletonContext(): SingletonServiceContext { return this.#singletonContext; }
    /** @internal Poison the registry after a singleton factory failure. */
    markSingletonFailure(): void {
        if (this.#singletonFailed) return;
        this.#singletonFailed = true;
        // The stored shutdown remains rejecting for external joiners, even when nobody awaits the factory.
        void this.beginShutdown().catch(() => {});
    }
    /** A live factory may outlast the execution that originally requested it. */
    hasLivingExecution(): boolean {
        let ancestor = this.#activeExecution.getStore();
        while (ancestor) {
            if (ancestor.state === ServiceExecutionState.Running) return true;
            ancestor = ancestor.parent;
        }
        return false;
    }
    /** Track waits across scopes: an in-flight singleton can be awaited by a different execution. */
    waitFor<T>(node: ServiceResolutionNode, name: string, chain: readonly ServiceResolutionNode[], task: Promise<T>): Promise<T> {
        const source = chain.filter(ancestor => ancestor.state === ServiceResolutionState.Pending).at(-1);
        if (node.state !== ServiceResolutionState.Pending || !source || serviceScopeRegistry(source.scope) !== this) return task;
        const reaches = (from: ServiceResolutionNode, target: ServiceResolutionNode, visited = new Set<ServiceResolutionNode>()): boolean => {
            if (from.state !== ServiceResolutionState.Pending) return false;
            if (from === target) return true;
            if (visited.has(from)) return false;
            visited.add(from);
            return [...this.#waits.get(from)?.keys() ?? []].some(next => reaches(next, target, visited));
        };
        if (reaches(node, source)) throw new ServiceDependencyError(`Service dependency cycle: ${name}`);
        const edges = this.#waits.get(source) ?? new Map<ServiceResolutionNode, number>();
        edges.set(node, (edges.get(node) ?? 0) + 1);
        this.#waits.set(source, edges);
        const release = (): void => {
            const remaining = (edges.get(node) ?? 1) - 1;
            if (remaining) edges.set(node, remaining);
            else edges.delete(node);
            if (!edges.size) this.#waits.delete(source);
        };
        void task.then(release, release);
        return task;
    }
    /** Caller instances and previously owned objects cannot become owned by an alias factory. */
    claim(value: unknown, scope: ServiceScope, token: ServiceToken<unknown>): boolean {
        if (typeof value !== 'object' && typeof value !== 'function') return false;
        const object = value as object;
        if (this.#owners.has(object)) {
            const owner = this.#owners.get(object);
            if (owner && owner !== scope && owner !== this.#singletons)
                throw new ServiceDependencyError(`Conflicting service ownership: ${token.name}`);
            return false;
        }
        this.#owners.set(object, scope);
        return true;
    }
    /** Keep the pipeline alive until its result and scope cleanup have completed. */
    async runExecution<T>(callback: () => Promise<T>, completed?: (result: T, hasLivingAncestor: boolean) => Promise<T>): Promise<T> {
        this.assertLive();
        let finish!: () => void;
        const completion = new Promise<void>(resolve => { finish = resolve; });
        const frame: ServiceExecutionFrame = { completion, parent: this.#activeExecution.getStore(), state: ServiceExecutionState.Running };
        this.#executions.add(completion);
        let result: T;
        try { result = await this.#activeExecution.run(frame, () => withServiceResolutionBoundary(callback)); }
        finally { frame.state = ServiceExecutionState.Drained; this.#executions.delete(completion); finish(); }
        return completed ? completed(result, this.hasLivingExecution() || hasLivingServiceResolution(this)) : result;
    }
    /** @internal Check only registration existence; never hide a failing service factory. */
    hasRegistration(identifier: ServiceIdentifier<unknown>): boolean {
        return this.#registrations.has(normalizeServiceToken(identifier).key);
    }
    /** @internal Retrieve a declaration without constructing its service. */
    registration(identifier: ServiceIdentifier<unknown>): ServiceRegistration<unknown> {
        const token = normalizeServiceToken(identifier);
        if (!token || typeof token.key !== 'symbol' || typeof token.name !== 'string')
            throw new ServiceDependencyError('Invalid service token');
        const registration = this.#registrations.get(token.key);
        if (!registration) throw new ServiceDependencyError(`Missing service: ${token.name}`);
        return registration;
    }
    /** Inspect declarations without invoking factories. */
    preflight(tokens: readonly ServiceIdentifier<unknown>[]): void {
        const visit = (identifier: ServiceIdentifier<unknown>, chain: readonly symbol[], singleton: boolean): void => {
            const token = normalizeServiceToken(identifier);
            const registration = this.registration(token);
            if (chain.includes(token.key)) throw new ServiceDependencyError(`Service dependency cycle: ${token.name}`);
            if (singleton && registration.lifetime !== 'singleton') throw new ServiceDependencyError(`Captive service dependency: ${token.name}`);
            if (registration.dependencies !== undefined && !Array.isArray(registration.dependencies))
                throw new ServiceDependencyError(`Invalid service dependencies: ${token.name}`);
            for (const dependency of registration.dependencies ?? []) visit(dependency, [...chain, token.key], singleton || registration.lifetime === 'singleton');
        };
        for (const token of tokens) visit(token, [], false);
    }
    createScope(identity: ExecutionContext): ServiceScope {
        this.assertLive();
        return new ServiceScope(this, identity);
    }
    singletonScope(): ServiceScope { return this.#singletons; }
    /** Directly constructed scopes participate in admission and shutdown too. */
    admitScope(scope: ServiceScope): void { this.assertLive(); this.#scopes.add(scope); }
    release(scope: ServiceScope): void { this.#scopes.delete(scope); }
    assertLive(): void { if (this.#state !== ServiceRegistryState.Running || this.#singletonFailed) throw new ServiceDependencyError('Service registry is disposed'); }
    dispose(): Promise<void> {
        if (this.hasLivingExecution() || hasLivingServiceResolution(this) || hasLivingServiceDisposal(this))
            return Promise.reject(new ServiceDependencyError('Cannot await service registry disposal from owned work'));
        return this.beginShutdown();
    }
    private beginShutdown(): Promise<void> {
        if (this.#closing) return this.#closing;
        this.#state = ServiceRegistryState.Draining;
        const executions = [...this.#executions];
        const scopes = [...this.#scopes];
        const completion = Promise.resolve().then(async () => {
            const errors: unknown[] = [];
            try {
                await Promise.allSettled(executions);
                for (const scope of scopes) {
                    try { await closeServiceScope(scope); } catch (error) { errors.push(error); }
                }
                try { await closeServiceScope(this.#singletons); } catch (error) { errors.push(error); }
                // Factories have settled; background work returned by a singleton may now stop.
                this.#lifetime.abort();
                try { await disposeCreatedServices(this.#singletons); } catch (error) { errors.push(error); }
            } finally {
                this.#state = ServiceRegistryState.Closed;
                this.#waits.clear();
            }
            if (errors.length) throw new AggregateError(errors, 'Service registry disposal failed');
        });
        this.#closing = completion;
        return completion;
    }
}
