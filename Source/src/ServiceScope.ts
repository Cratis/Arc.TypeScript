// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ExecutionContext } from './ExecutionContext.js';
import type { ServiceToken } from './ServiceToken.js';
import type { ServiceRegistry } from './ServiceRegistry.js';
import { ServiceDependencyError } from './ServiceDependencyError.js';
import type { ServiceResolutionNode } from './ServiceResolutionNode.js';
import { ServiceResolutionState } from './ServiceResolutionState.js';
import { ServiceScopeState } from './ServiceScopeState.js';
const resolution = new AsyncLocalStorage<{ owner: ServiceResolutionNode | undefined; chain: readonly ServiceResolutionNode[]; singleton: boolean; identity: ExecutionContext | undefined } | undefined>();
const current = new AsyncLocalStorage<ServiceScope>();
/** Nested executions inherit causal dependencies, but use their own identity and lifetime guard. */
export function withServiceResolutionBoundary<T>(callback: () => T): T {
    const active = resolution.getStore();
    return resolution.run(active ? { owner: undefined, chain: active.chain, singleton: false, identity: undefined } : undefined, callback);
}
/** Available only while an Arc pipeline is running with its owned service scope. */
export function currentServices(): ServiceScope {
    const scope = current.getStore();
    if (!scope || scope.disposed) throw new ServiceDependencyError('No live Arc service scope');
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
    constructor(readonly registry: ServiceRegistry, readonly identity: ExecutionContext | undefined, readonly singleton = false) {}
    get disposed(): boolean { return this.#state !== ServiceScopeState.Open; }
    resolve<T>(token: ServiceToken<T>): Promise<T> {
        if (this.disposed || this.registry.disposed) throw new ServiceDependencyError('Service scope is disposed');
        this.registry.preflight([token]);
        const active = resolution.getStore();
        const chain = active?.chain.filter(node => node.state === ServiceResolutionState.Pending) ?? [];
        const owner = active?.owner;
        const inherit = owner?.state === ServiceResolutionState.Pending && owner.scope.registry === this.registry;
        const identity = inherit ? active?.identity : this.identity;
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
        const registration = this.registry.registration(token);
        if (captive && registration.lifetime !== 'singleton') throw new ServiceDependencyError(`Captive service dependency: ${token.name}`);
        if (registration.lifetime === 'singleton' && !this.singleton)
            return this.registry.singletonScope().resolveInChain(token, identity, chain, captive);
        if (this.disposed) throw new ServiceDependencyError('Service scope is disposed');
        if (chain.some(ancestor => ancestor.state === ServiceResolutionState.Pending && ancestor.scope === this && ancestor.token === token.key))
            throw new ServiceDependencyError(`Service dependency cycle: ${token.name}`);
        const cached = registration.lifetime !== 'transient' ? this.#cache.get(token.key) : undefined;
        if (cached) {
            const node = this.#nodes.get(token.key)!;
            return this.registry.waitFor(node, token.name, chain, cached as Promise<T>);
        }
        const node: ServiceResolutionNode = { scope: this, token: token.key, state: ServiceResolutionState.Pending };
        if (registration.lifetime !== 'transient') this.#nodes.set(token.key, node);
        const task = resolution.run({ owner: node, chain: [...chain, node], singleton: captive || registration.lifetime === 'singleton', identity }, async (): Promise<T> => {
            if (Object.hasOwn(registration, 'instance')) return registration.instance as T;
            if (!identity || !registration.factory) throw new ServiceDependencyError(`Missing service factory or execution identity: ${token.name}`);
            let value: unknown;
            try { value = await registration.factory(this, identity); }
            catch (error) {
                if (error instanceof ServiceDependencyError) throw error;
                throw new ServiceDependencyError(`Service factory failed: ${token.name}`, { cause: error });
            }
            if (value === undefined || value === null) throw new ServiceDependencyError(`Service factory returned no value: ${token.name}`);
            if (this.registry.claim(value, this, token)) this.#created.push(value as object);
            return value as T;
        });
        this.#pending.add(task);
        void task.then(() => { node.state = ServiceResolutionState.Settled; this.#pending.delete(task); }, () => {
            node.state = ServiceResolutionState.Settled;
            this.#pending.delete(task);
            if (this.singleton) this.registry.markSingletonFailure();
            if (this.#cache.get(token.key) === task) {
                this.#cache.delete(token.key);
                this.#nodes.delete(token.key);
            }
        });
        if (registration.lifetime !== 'transient') this.#cache.set(token.key, task);
        return this.registry.waitFor(node, token.name, chain, task);
    }
    dispose(): Promise<void> {
        if (this.#closing) return this.#closing;
        this.#state = ServiceScopeState.Closing;
        const completion = Promise.resolve().then(() => this.closeCore());
        this.#closing = completion;
        const settled = (): void => {
            this.#state = ServiceScopeState.Closed;
            this.registry.release(this);
        };
        void completion.then(settled, settled);
        return completion;
    }
    private async closeCore(): Promise<void> {
        const errors: unknown[] = [];
        while (this.#pending.size) await Promise.allSettled([...this.#pending]);
        for (const value of this.#created.reverse()) {
            try {
                const asyncDispose = (value as AsyncDisposable)[Symbol.asyncDispose];
                const syncDispose = (value as Disposable)[Symbol.dispose];
                if (typeof asyncDispose === 'function') await asyncDispose.call(value);
                else if (typeof syncDispose === 'function') syncDispose.call(value);
            } catch (error) { errors.push(error); }
        }
        this.#cache.clear();
        this.#nodes.clear();
        if (errors.length) throw new AggregateError(errors, 'Service disposal failed');
    }
}
