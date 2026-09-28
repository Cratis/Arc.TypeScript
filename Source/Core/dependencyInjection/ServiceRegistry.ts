// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from './ServiceLifetime.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { ServiceRegistration } from './ServiceRegistration.js';
import type { ServiceToken } from './ServiceToken.js';
import { normalizeServiceToken, type ServiceIdentifier } from './ServiceIdentifier.js';
import { ServiceScope, closeServiceScope, createBorrowableServiceScope, createSingletonServiceScope, disposeCreatedServices, hasLivingServiceDisposal, hasLivingServiceResolution, serviceScopeRegistry, withServiceResolutionBoundary } from './ServiceScope.js';
import type { ServiceResolutionNode } from './ServiceResolutionNode.js';
import type { ServiceExecutionFrame } from './ServiceExecutionFrame.js';
import { ServiceDependencyError } from './ServiceDependencyError.js';
import { ServiceResolutionState } from './ServiceResolutionState.js';
import { ServiceExecutionState } from './ServiceExecutionState.js';
import { ServiceRegistryState } from './ServiceRegistryState.js';
import type { SingletonServiceContext } from './SingletonServiceContext.js';
import type { ShutdownParticipant } from './ShutdownParticipant.js';
import type { ShutdownParticipantFrame } from './ShutdownParticipantFrame.js';

/** Owns registrations and singleton instances. Dispose when the host shuts down. */
export class ServiceRegistry {
    readonly #registrations = new Map<symbol, ServiceRegistration<unknown>>();
    readonly #scopes = new Set<ServiceScope>();
    readonly #executions = new Set<Promise<void>>();
    readonly #activeExecution = new AsyncLocalStorage<ServiceExecutionFrame>();
    readonly #activeParticipant = new AsyncLocalStorage<ShutdownParticipantFrame>();
    readonly #participants = new Set<ShutdownParticipant>();
    readonly #shutdownCleanups = new Set<{ stop: () => void; cleanup: () => Promise<void>; finish?: () => Promise<void> }>();
    readonly #waits = new Map<ServiceResolutionNode, Map<ServiceResolutionNode, number>>();
    readonly #owners = new WeakMap<object, ServiceScope | null>();
    readonly #singletons: ServiceScope;
    readonly #lifetime = new AbortController();
    readonly #singletonContext: SingletonServiceContext = Object.freeze({ signal: this.#lifetime.signal });
    #state = ServiceRegistryState.Running;
    #singletonFailed = false;
    #shutdownHasParticipants = false;
    #closing: Promise<void> | undefined;

    constructor(registrations: readonly ServiceRegistration<unknown>[] = []) {
        for (const entry of registrations) {
            const token = normalizeServiceToken(entry.token);
            const registration = { ...entry, token, dependencies: entry.dependencies?.map(normalizeServiceToken) };
            if (!registration.token || typeof registration.token.key !== 'symbol' || typeof registration.token.name !== 'string')
                throw new ServiceDependencyError('Invalid service token');
            if (this.#registrations.has(registration.token.key)) throw new ServiceDependencyError(`Duplicate service: ${registration.token.name}`);
            if (![ServiceLifetime.Singleton, ServiceLifetime.Scoped, ServiceLifetime.Transient].includes(registration.lifetime) ||
                (registration.factory === undefined) === !Object.hasOwn(registration, 'instance') ||
                Object.hasOwn(registration, 'instance') && (registration.instance === undefined || registration.instance === null))
                throw new ServiceDependencyError(`Invalid service registration: ${registration.token.name}`);
            if (Object.hasOwn(registration, 'instance') && registration.lifetime !== ServiceLifetime.Singleton)
                throw new ServiceDependencyError(`Instance must be singleton: ${registration.token.name}`);
            if (Object.hasOwn(registration, 'instance') && (typeof registration.instance === 'object' || typeof registration.instance === 'function'))
                this.#owners.set(registration.instance as object, null);
            this.#registrations.set(registration.token.key, registration);
        }
        this.#singletons = createSingletonServiceScope(this);
    }
    get disposed(): boolean { return this.#state !== ServiceRegistryState.Running; }
    get singletonFailed(): boolean { return this.#singletonFailed; }
    /** @internal Whether shutdown has participants whose work may depend on an admitted operation. */
    get hasShutdownParticipants(): boolean { return this.#participants.size > 0 || this.#shutdownHasParticipants; }
    /**
     * Register a shutdown participant while admission is open. Its stop runs before any drain;
     * all drains settle before scopes and singletons close. Remove an unused participant by
     * calling the returned function; removal after shutdown begins does not affect that shutdown.
     */
    addShutdownParticipant(participant: ShutdownParticipant): () => void {
        this.assertLive();
        if (!participant || typeof participant.stop !== 'function' || typeof participant.drain !== 'function')
            throw new ServiceDependencyError('Invalid shutdown participant');
        this.#participants.add(participant);
        return () => { this.#participants.delete(participant); };
    }
    /** @internal Server-owned transport cancellation and cleanup, registered before shutdown can start. */
    addShutdownCleanup(stop: () => void, cleanup: () => Promise<void>, finish?: () => Promise<void>): void {
        this.assertLive();
        this.#shutdownCleanups.add({ stop, cleanup, finish });
    }
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
    runExecution<T>(callback: () => Promise<T>, completed?: (result: T, hasLivingAncestor: boolean) => Promise<T>): Promise<T> {
        return this.trackExecution(() => withServiceResolutionBoundary(callback), completed);
    }
    /** @internal Borrowed callbacks preserve the active singleton captive-dependency guard. */
    runBorrowedExecution<T>(callback: () => Promise<T>): Promise<T> {
        return this.trackExecution(callback);
    }
    private async trackExecution<T>(callback: () => Promise<T>, completed?: (result: T, hasLivingAncestor: boolean) => Promise<T>): Promise<T> {
        this.assertLive();
        let finish!: () => void;
        const completion = new Promise<void>(resolve => { finish = resolve; });
        const frame: ServiceExecutionFrame = { completion, parent: this.#activeExecution.getStore(), state: ServiceExecutionState.Running };
        this.#executions.add(completion);
        let result: T;
        try { result = await this.#activeExecution.run(frame, callback); }
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
            if (singleton && registration.lifetime !== ServiceLifetime.Singleton)
                throw new ServiceDependencyError(`Captive service dependency: ${token.name}`);
            if (registration.dependencies !== undefined && !Array.isArray(registration.dependencies))
                throw new ServiceDependencyError(`Invalid service dependencies: ${token.name}`);
            for (const dependency of registration.dependencies ?? []) visit(dependency, [...chain, token.key],
                singleton || registration.lifetime === ServiceLifetime.Singleton);
        };
        for (const token of tokens) visit(token, [], false);
    }
    createScope(identity: ExecutionContext): ServiceScope {
        this.assertLive();
        return createBorrowableServiceScope(this, identity);
    }
    singletonScope(): ServiceScope { return this.#singletons; }
    /** Directly constructed scopes participate in admission and shutdown too. */
    admitScope(scope: ServiceScope): void { this.assertLive(); this.#scopes.add(scope); }
    release(scope: ServiceScope): void { this.#scopes.delete(scope); }
    assertLive(): void { if (this.#state !== ServiceRegistryState.Running || this.#singletonFailed) throw new ServiceDependencyError('Service registry is disposed'); }
    /** @internal Reject self-joins before a server begins or joins its own teardown. */
    assertCanDispose(): void {
        if (this.hasLivingExecution() || hasLivingServiceResolution(this) || hasLivingServiceDisposal(this) ||
            this.#activeParticipant.getStore()?.state === ServiceExecutionState.Running)
            throw new ServiceDependencyError('Cannot await service registry disposal from owned work');
    }
    dispose(): Promise<void> {
        try { this.assertCanDispose(); }
        catch (error) { return Promise.reject(error); }
        return this.beginShutdown();
    }
    private beginShutdown(): Promise<void> {
        if (this.#closing) return this.#closing;
        this.#state = ServiceRegistryState.Draining;
        const executions = [...this.#executions];
        const scopes = [...this.#scopes];
        const participants = [...this.#participants];
        this.#shutdownHasParticipants = participants.length > 0;
        const cleanups = [...this.#shutdownCleanups];
        const completion = Promise.resolve().then(async () => {
            const errors: unknown[] = [];
            const reported = new Set<unknown>();
            const record = (error: unknown): void => {
                const leaves = (value: unknown): unknown[] => value instanceof AggregateError && value.errors.length
                    ? value.errors.flatMap(leaves) : [value];
                const values = leaves(error);
                const unseen: unknown[] = [];
                for (const value of values) {
                    const reference = value !== null && (typeof value === 'object' || typeof value === 'function');
                    if (reference && reported.has(value)) continue;
                    unseen.push(value);
                    if (reference) reported.add(value);
                }
                if (unseen.length) errors.push(unseen.length === values.length ? error : new AggregateError(unseen, 'Service disposal failed'));
            };
            try {
                // Close admission and transport before participant stop; leave session-owned
                // scopes alive until participants and tracked executions have settled.
                for (const hook of cleanups) {
                    try { hook.stop(); } catch (error) { record(error); }
                }
                for (const hook of cleanups) {
                    try { await hook.cleanup(); } catch (error) { record(error); }
                }
                if (participants.length) {
                    // A stop continuation inherits its participant frame. Keep it live through drain.
                    const frames = participants.map((): ShutdownParticipantFrame => ({ state: ServiceExecutionState.Running }));
                    const stops: Promise<unknown>[] = [];
                    for (const [index, participant] of participants.entries()) {
                        try {
                            // Assimilate structural thenables while the participant frame is active.
                            stops.push(this.#activeParticipant.run(frames[index]!, () => Promise.resolve(participant.stop())));
                        } catch (error) { record(error); }
                    }
                    const stopped = await Promise.allSettled(stops);
                    for (const outcome of stopped) if (outcome.status === 'rejected') record(outcome.reason);
                    const drains = await Promise.allSettled(participants.map((participant, index) =>
                        this.#activeParticipant.run(frames[index]!, () => Promise.resolve().then(() => participant.drain()))));
                    for (const outcome of drains) if (outcome.status === 'rejected') record(outcome.reason);
                    for (const frame of frames) frame.state = ServiceExecutionState.Drained;
                }
                await Promise.allSettled(executions);
                for (const hook of cleanups) {
                    if (hook.finish) try { await hook.finish(); } catch (error) { record(error); }
                }
                for (const scope of scopes) {
                    try { await closeServiceScope(scope); } catch (error) { record(error); }
                }
                try { await closeServiceScope(this.#singletons); } catch (error) { record(error); }
                // Factories have settled; background work returned by a singleton may now stop.
                this.#lifetime.abort();
                try { await disposeCreatedServices(this.#singletons); } catch (error) { record(error); }
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
