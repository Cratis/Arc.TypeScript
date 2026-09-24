// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ExecutionContext } from './ExecutionContext.js';
import type { ServiceRegistration } from './ServiceRegistration.js';
import type { ServiceToken } from './ServiceToken.js';
import { ServiceScope, withServiceResolutionBoundary } from './ServiceScope.js';
import type { ServiceResolutionNode } from './ServiceResolutionNode.js';
import type { ServiceExecutionFrame } from './ServiceExecutionFrame.js';
import { ServiceDependencyError } from './ServiceDependencyError.js';
import { ServiceResolutionState } from './ServiceResolutionState.js';
import { ServiceExecutionState } from './ServiceExecutionState.js';

/** Owns registrations and singleton instances. Dispose when the host shuts down. */
export class ServiceRegistry {
    readonly #registrations = new Map<symbol, ServiceRegistration<unknown>>();
    readonly #scopes = new Set<ServiceScope>();
    readonly #executions = new Set<Promise<void>>();
    readonly #activeExecution = new AsyncLocalStorage<ServiceExecutionFrame>();
    readonly #waits = new Map<ServiceResolutionNode, Map<ServiceResolutionNode, number>>();
    readonly #owners = new WeakMap<object, ServiceScope | null>();
    readonly #singletons: ServiceScope;
    #disposed = false;
    #singletonFailed = false;
    #closing: Promise<void> | undefined;

    constructor(registrations: readonly ServiceRegistration<unknown>[] = []) {
        for (const registration of registrations) {
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
        this.#singletons = new ServiceScope(this, undefined, true);
    }
    get disposed(): boolean { return this.#disposed; }
    get singletonFailed(): boolean { return this.#singletonFailed; }
    markSingletonFailure(): void { this.#singletonFailed = true; }
    /** Track waits across scopes: an in-flight singleton can be awaited by a different execution. */
    waitFor<T>(node: ServiceResolutionNode, name: string, chain: readonly ServiceResolutionNode[], task: Promise<T>): Promise<T> {
        const source = chain.filter(ancestor => ancestor.state === ServiceResolutionState.Pending).at(-1);
        if (node.state !== ServiceResolutionState.Pending || !source || source.scope.registry !== this) return task;
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
            if (owner && owner !== scope && !owner.singleton)
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
        let ancestor = frame.parent;
        while (ancestor) {
            if (ancestor.state === ServiceExecutionState.Running) return completed ? completed(result, true) : result;
            ancestor = ancestor.parent;
        }
        return completed ? completed(result, false) : result;
    }
    registration(token: ServiceToken<unknown>): ServiceRegistration<unknown> {
        if (!token || typeof token.key !== 'symbol' || typeof token.name !== 'string')
            throw new ServiceDependencyError('Invalid service token');
        const registration = this.#registrations.get(token.key);
        if (!registration) throw new ServiceDependencyError(`Missing service: ${token.name}`);
        return registration;
    }
    /** Inspect declarations without invoking factories. */
    preflight(tokens: readonly ServiceToken<unknown>[]): void {
        const visit = (token: ServiceToken<unknown>, chain: readonly symbol[], singleton: boolean): void => {
            const registration = this.registration(token);
            if (chain.includes(token.key)) throw new ServiceDependencyError(`Service dependency cycle: ${token.name}`);
            if (singleton && registration.lifetime !== 'singleton') throw new ServiceDependencyError(`Captive service dependency: ${token.name}`);
            if (registration.dependencies !== undefined && !Array.isArray(registration.dependencies))
                throw new ServiceDependencyError(`Invalid service dependencies: ${token.name}`);
            for (const dependency of registration.dependencies ?? []) visit(dependency, [...chain, token.key], singleton || registration.lifetime === 'singleton');
        };
        this.assertLive();
        for (const token of tokens) visit(token, [], false);
    }
    createScope(identity: ExecutionContext): ServiceScope {
        this.assertLive();
        const scope = new ServiceScope(this, identity);
        this.#scopes.add(scope);
        return scope;
    }
    singletonScope(): ServiceScope { return this.#singletons; }
    release(scope: ServiceScope): void { this.#scopes.delete(scope); }
    assertLive(): void { if (this.#disposed || this.#singletonFailed) throw new ServiceDependencyError('Service registry is disposed'); }
    dispose(): Promise<void> {
        if (this.#closing) return this.#closing;
        this.#disposed = true;
        const executions = [...this.#executions];
        const scopes = [...this.#scopes];
        const completion = Promise.resolve().then(async () => {
            const errors: unknown[] = [];
            await Promise.allSettled(executions);
            for (const scope of scopes) {
                try { await scope.dispose(); } catch (error) { errors.push(error); }
            }
            try { await this.#singletons.dispose(); } catch (error) { errors.push(error); }
            this.#waits.clear();
            if (errors.length) throw new AggregateError(errors, 'Service registry disposal failed');
        });
        this.#closing = completion;
        return completion;
    }
}
