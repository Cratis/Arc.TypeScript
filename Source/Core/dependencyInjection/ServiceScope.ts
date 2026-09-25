// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from './ServiceLifetime.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { ServiceToken } from './ServiceToken.js';
import { normalizeServiceToken, type ServiceIdentifier } from './ServiceIdentifier.js';
import type { ServiceRegistry } from './ServiceRegistry.js';
import { ServiceDependencyError } from './ServiceDependencyError.js';
import type { ServiceResolutionNode } from './ServiceResolutionNode.js';
import { ServiceResolutionState } from './ServiceResolutionState.js';
import { ServiceScopeState } from './ServiceScopeState.js';
import { withoutRequestContext } from '../execution/RequestContextStore.js';
import type { ServiceDisposalFrame } from './ServiceDisposalFrame.js';
import { ServiceDisposalState } from './ServiceDisposalState.js';
const singletonCapability = Symbol('singleton scope');
const internals = new WeakMap<ServiceScope, { registry: ServiceRegistry; close: () => Promise<void>; disposeCreated: () => Promise<void> }>();
const disposal = new AsyncLocalStorage<ServiceDisposalFrame>();
/** Package-private shutdown entry points; never methods on the public scope. */
export function createSingletonServiceScope(registry: ServiceRegistry): ServiceScope {
    return Reflect.construct(ServiceScope, [registry, undefined, singletonCapability]) as ServiceScope;
}
export function closeServiceScope(scope: ServiceScope): Promise<void> { return internals.get(scope)!.close(); }
export function disposeCreatedServices(scope: ServiceScope): Promise<void> { return internals.get(scope)!.disposeCreated(); }
export function serviceScopeRegistry(scope: ServiceScope): ServiceRegistry { return internals.get(scope)!.registry; }
/** A live disposer cannot join registry shutdown, including through nested disposal. */
export function hasLivingServiceDisposal(registry: ServiceRegistry, scope?: ServiceScope): boolean {
    let frame = disposal.getStore();
    while (frame) {
        if (frame.state === ServiceDisposalState.Running && serviceScopeRegistry(frame.scope) === registry && (!scope || frame.scope === scope)) return true;
        frame = frame.parent;
    }
    return false;
}
const resolution = new AsyncLocalStorage<{ owner: ServiceResolutionNode | undefined; chain: readonly ServiceResolutionNode[]; singleton: boolean; identity: ExecutionContext | undefined } | undefined>();
const current = new AsyncLocalStorage<ServiceScope>();
/** Includes detached factories after their originating request frame has drained. */
export function hasLivingServiceResolution(registry: ServiceRegistry): boolean {
    return resolution.getStore()?.chain.some(node => serviceScopeRegistry(node.scope) === registry && node.state === ServiceResolutionState.Pending) ?? false;
}
/** Nested executions inherit causal dependencies, but use their own identity and lifetime guard. */
export function withServiceResolutionBoundary<T>(callback: () => T): T {
    const active = resolution.getStore();
    return resolution.run(active ? { owner: undefined, chain: active.chain, singleton: false, identity: undefined } : undefined, callback);
}
/** Available only while an Arc pipeline is running with its owned service scope. */
export function currentServices(): ServiceScope {
    const scope = current.getStore();
    if (!scope || !scope.canResolve()) throw new ServiceDependencyError('No live Arc service scope');
    return scope;
}
export function withServices<T>(scope: ServiceScope, callback: () => T): T { return current.run(scope, callback); }

/** A single execution's owned services. Do not reuse after disposal. */
export class ServiceScope {
    readonly #created: object[] = [];
    readonly #pending = new Set<Promise<unknown>>();
    readonly #cache = new Map<symbol, Promise<unknown>>();
    readonly #nodes = new Map<symbol, ServiceResolutionNode>();
    #state = ServiceScopeState.Open;
    #closing: Promise<void> | undefined;
    readonly #singleton: boolean;
    readonly #registry: ServiceRegistry;
    readonly #identity: ExecutionContext | undefined;
    constructor(registry: ServiceRegistry, identity: ExecutionContext | undefined);
    constructor(registry: ServiceRegistry, identity: ExecutionContext | undefined, ...capability: unknown[]) {
        if (capability.length && (capability.length !== 1 || capability[0] !== singletonCapability))
            throw new ServiceDependencyError('Invalid service scope construction');
        this.#registry = registry;
        this.#identity = identity;
        this.#singleton = capability.length === 1;
        if (this.#singleton) registry.assertLive();
        else registry.admitScope(this);
        internals.set(this, { registry, close: () => this.#closeInternal(), disposeCreated: () => this.#disposeCreated() });
    }
    get singleton(): boolean { return this.#singleton; }
    get registry(): ServiceRegistry { return this.#registry; }
    get identity(): ExecutionContext | undefined { return this.#identity; }
    get disposed(): boolean { return this.#state !== ServiceScopeState.Open; }
    /** Closing scopes only accept dependencies from their own still-live factory attempts. */
    canResolve(): boolean {
        if (this.#registry.singletonFailed || this.#state === ServiceScopeState.Closed) return false;
        if (this.#state === ServiceScopeState.Open) return true;
        const active = resolution.getStore();
        return active?.chain.some(node => node.scope === this && node.state === ServiceResolutionState.Pending) ?? false;
    }
    resolve<T>(identifier: ServiceIdentifier<T>): Promise<T> {
        const token = normalizeServiceToken(identifier);
        if (!this.canResolve()) throw new ServiceDependencyError('Service scope is disposed');
        this.#registry.preflight([token]);
        const active = resolution.getStore();
        const chain = active?.chain.filter(node => node.state === ServiceResolutionState.Pending) ?? [];
        const owner = active?.owner;
        const inherit = owner?.state === ServiceResolutionState.Pending && serviceScopeRegistry(owner.scope) === this.#registry;
        const identity = this.#singleton ? undefined : this.#identity;
        const captive = inherit ? active?.singleton ?? false : false;
        const task = this.resolveInChain(token, identity, chain, captive);
        if (chain.length || current.getStore() === this) return task;
        return task.catch(async error => {
            const cleanupErrors: unknown[] = [];
            try { await this.dispose(); } catch (failure) { cleanupErrors.push(failure); }
            if (cleanupErrors.length) throw new ServiceDependencyError(`Service resolution cleanup failed: ${token.name}`, {
                cause: new AggregateError([error, ...cleanupErrors])
            });
            throw error;
        });
    }
    private resolveInChain<T>(token: ServiceToken<T>, identity: ExecutionContext | undefined, chain: readonly ServiceResolutionNode[], captive: boolean): Promise<T> {
        if (!this.canResolve()) throw new ServiceDependencyError('Service scope is disposed');
        const registration = this.#registry.registration(token);
        if ((captive || this.#singleton) &&
            registration.lifetime !== ServiceLifetime.Singleton)
            throw new ServiceDependencyError(`Captive service dependency: ${token.name}`);
        if (registration.lifetime === ServiceLifetime.Singleton && !this.#singleton)
            return this.#registry.singletonScope().resolveInChain(token, identity, chain, captive);
        if (chain.some(ancestor => ancestor.state === ServiceResolutionState.Pending && ancestor.scope === this && ancestor.token === token.key))
            throw new ServiceDependencyError(`Service dependency cycle: ${token.name}`);
        const cached = registration.lifetime !== ServiceLifetime.Transient ? this.#cache.get(token.key) : undefined;
        if (cached) {
            const node = this.#nodes.get(token.key)!;
            return this.#registry.waitFor(node, token.name, chain, cached as Promise<T>);
        }
        const node: ServiceResolutionNode = { scope: this, token: token.key, state: ServiceResolutionState.Pending };
        if (registration.lifetime !== ServiceLifetime.Transient) this.#nodes.set(token.key, node);
        // The microtask publishes the cache and pending owner before user code can reenter resolution.
        const task = resolution.run({ owner: node, chain: [...chain, node], singleton: captive ||
            registration.lifetime === ServiceLifetime.Singleton, identity }, () =>
            Promise.resolve().then(() => withServices(this, () => registration.lifetime === ServiceLifetime.Singleton
                ? withoutRequestContext(() => this.construct(token, () => registration.factory?.(this, this.#registry.singletonContext) as T | Promise<T> | undefined, registration.instance as T | undefined))
                : this.construct(token, () => identity && registration.factory?.(this, identity) as T | Promise<T> | undefined))));

        this.#pending.add(task);
        void task.then(() => { node.state = ServiceResolutionState.Settled; this.#pending.delete(task); }, () => {
            node.state = ServiceResolutionState.Settled;
            this.#pending.delete(task);
            if (this.#singleton && registration.lifetime === ServiceLifetime.Singleton) this.#registry.markSingletonFailure();
            if (this.#cache.get(token.key) === task) {
                this.#cache.delete(token.key);
                this.#nodes.delete(token.key);
            }
        });
        if (registration.lifetime !== ServiceLifetime.Transient) this.#cache.set(token.key, task);
        return this.#registry.waitFor(node, token.name, chain, task);
    }
    private async construct<T>(token: ServiceToken<T>, factory: () => T | Promise<T> | undefined, instance?: T): Promise<T> {
        if (instance !== undefined) return instance;
        let value: T;
        try {
            const created = factory();
            if (created === undefined) throw new ServiceDependencyError(`Missing service factory or execution identity: ${token.name}`);
            value = await created;
        }
        catch (error) {
            if (error instanceof ServiceDependencyError) throw error;
            throw new ServiceDependencyError(`Service factory failed: ${token.name}`, { cause: error });
        }
        if (value === undefined || value === null) throw new ServiceDependencyError(`Service factory returned no value: ${token.name}`);
        if (this.#registry.claim(value, this, token)) this.#created.push(value as object);
        return value;
    }
    dispose(): Promise<void> {
        if (hasLivingServiceDisposal(this.#registry, this) || resolution.getStore()?.chain.some(node => node.scope === this && node.state === ServiceResolutionState.Pending))
            return Promise.reject(new ServiceDependencyError('Cannot await service scope disposal from owned work'));
        return closeServiceScope(this);
    }
    /** Internal shutdown initiation does not join from inside a user callback. */
    #closeInternal(): Promise<void> {
        if (this.#closing) return this.#closing;
        this.#state = ServiceScopeState.Closing;
        const completion = Promise.resolve().then(() => this.#closeCore());
        this.#closing = completion;
        const settled = (): void => {
            this.#state = ServiceScopeState.Closed;
            this.#registry.release(this);
        };
        void completion.then(settled, settled);
        return completion;
    }
    async #closeCore(): Promise<void> {
        while (this.#pending.size) await Promise.allSettled([...this.#pending]);
        if (!this.#singleton) await this.#disposeCreated();
    }
    /** Root resources stop only after construction quiesces and the registry signal aborts. */
    async #disposeCreated(): Promise<void> {
        const errors: unknown[] = [];
        for (const value of this.#created.reverse()) {
            try {
                const frame: ServiceDisposalFrame = { scope: this, parent: disposal.getStore(), state: ServiceDisposalState.Running };
                try {
                    await disposal.run(frame, () => {
                        const dispose = async (): Promise<void> => {
                            const asyncDispose = (value as AsyncDisposable)[Symbol.asyncDispose];
                            const syncDispose = (value as Disposable)[Symbol.dispose];
                            if (typeof asyncDispose === 'function') await asyncDispose.call(value);
                            else if (typeof syncDispose === 'function') syncDispose.call(value);
                        };
                        return this.#singleton ? withoutRequestContext(dispose) : dispose();
                    });
                } finally { frame.state = ServiceDisposalState.Settled; }
            } catch (error) { errors.push(error); }
        }
        this.#created.length = 0;
        this.#cache.clear();
        this.#nodes.clear();
        if (errors.length) throw new AggregateError(errors, 'Service disposal failed');
    }
}
