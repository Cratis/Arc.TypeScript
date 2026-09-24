// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServerOptions } from '../ArcServerOptions.js';
import type { ExecutionContext, QueryOptions } from '../index.js';
import type { Operation } from '../http/Operation.js';
import type { ServiceRegistry } from '../dependencyInjection/ServiceRegistry.js';
import { ObservableQuerySession } from './observable/ObservableQuerySession.js';
import { ObservableSubscriptionLimitError } from './observable/ObservableSubscriptionLimitError.js';
import { isObservableOperation } from './observable/ObservableOperation.js';
import { observableCallerKey } from './observable/observableCallerKey.js';
import type { ObservableLimits } from './observable/ObservableLimits.js';

export class ObservableSessions {
    readonly #observableSessions = new Set<ObservableQuerySession>();
    readonly #snapshotSessions = new Set<ObservableQuerySession>();
    readonly #retiringSessions = new Set<ObservableQuerySession>();
    readonly #observableOwners = new Map<ObservableQuerySession, string>();
    readonly #openingOwners = new Map<string, number>();
    readonly #cleanupFailures: unknown[] = [];
    readonly #reportedCleanup = new WeakSet<object>();
    #cleanupFailureCount = 0;
    #openingObservableSessions = 0;
    #openingSnapshots = 0;
    #disposed = false;

    constructor(private readonly options: ArcServerOptions, private readonly services: ServiceRegistry,
        private readonly observableLimits: ObservableLimits, private readonly queries: () => readonly Operation[]) {}

    get sessions(): readonly ObservableQuerySession[] {
        return [...new Set([...this.#observableSessions, ...this.#snapshotSessions, ...this.#retiringSessions])];
    }
    get cleanupFailures(): readonly unknown[] { return this.#cleanupFailures; }
    get cleanupFailureCount(): number { return this.#cleanupFailureCount; }
    recordCleanupFailure(session: object, error: unknown): boolean {
        if (this.#reportedCleanup.has(session)) return false;
        this.#reportedCleanup.add(session);
        this.#cleanupFailureCount++;
        if (this.#cleanupFailures.length < 16) this.#cleanupFailures.push(error);
        return true;
    }
    markDisposed(): void { this.#disposed = true; }

    private callerKey(context: ExecutionContext): string { return observableCallerKey(context); }

    private hasSessionCapacity(context: ExecutionContext): boolean {
        const key = this.callerKey(context);
        const owned = [...this.#observableOwners.values()].filter(owner => owner === key).length;
        return !this.#disposed && this.observableLimits.hasSubscriptionCapacity(
            this.#observableSessions.size, this.#openingObservableSessions,
            owned, this.#openingOwners.get(key) ?? 0);
    }

    reserveSession(session: ObservableQuerySession, context: ExecutionContext): void {
        const key = this.callerKey(context);
        if (!this.hasSessionCapacity(context)) throw new ObservableSubscriptionLimitError();
        this.#snapshotSessions.delete(session);
        this.#observableSessions.add(session);
        this.#observableOwners.set(session, key);
    }

    async openSession(name: string, input: unknown, context: ExecutionContext, options: QueryOptions | undefined,
        admission: 'subscription' | 'snapshot'): Promise<ObservableQuerySession> {
        if (this.#disposed) throw new Error('Arc server is disposed');
        if (context.signal.aborted) throw new Error('Observable subscription was canceled');
        const operation = this.queries().find(item => [item.namespace, item.name].filter(Boolean).join('.') === name);
        if (!operation || !isObservableOperation(operation)) throw new Error(`Unknown observable query: ${name}`);
        const key = this.callerKey(context);
        let releaseOwner = (): void => {};
        if (admission === 'subscription') {
            if (!this.hasSessionCapacity(context)) throw new ObservableSubscriptionLimitError();
            this.#openingOwners.set(key, (this.#openingOwners.get(key) ?? 0) + 1);
            this.#openingObservableSessions++;
            let ownerReleased = false;
            releaseOwner = (): void => {
                if (ownerReleased) return;
                ownerReleased = true;
                const remaining = (this.#openingOwners.get(key) ?? 1) - 1;
                if (remaining) this.#openingOwners.set(key, remaining);
                else this.#openingOwners.delete(key);
            };
            context.signal.addEventListener('abort', releaseOwner, { once: true });
            if (context.signal.aborted) releaseOwner();
        } else {
            if (++this.#openingSnapshots + this.#snapshotSessions.size > this.observableLimits.subscriptions) {
                this.#openingSnapshots--;
                throw new ObservableSubscriptionLimitError();
            }
        }
        try {
            const held: { session?: ObservableQuerySession } = {};
            const session = await ObservableQuerySession.open({
                operation, input, context, options, services: this.services,
                guards: this.options.observableEmissionGuards ?? [], development: this.options.development === true,
                pendingEmissions: this.observableLimits.pendingEmissions,
                reportFailure: error => Promise.resolve(this.options.logger?.(error, context.correlationId)),
                onRelease: () => {
                    if (!held.session) return;
                    this.#observableSessions.delete(held.session);
                    this.#snapshotSessions.delete(held.session);
                    this.#observableOwners.delete(held.session);
                    this.#retiringSessions.add(held.session);
                },
                onClose: () => {
                    if (!held.session) return;
                    this.#observableSessions.delete(held.session);
                    this.#snapshotSessions.delete(held.session);
                    this.#observableOwners.delete(held.session);
                    this.#retiringSessions.delete(held.session);
                }
            });
            held.session = session;
            if (this.#disposed || this.services.disposed) {
                await session.close();
                throw new Error('Arc server is disposed');
            }
            if (!session.rejection) {
                if (admission === 'snapshot') this.#snapshotSessions.add(session);
                else {
                    this.#observableSessions.add(session);
                    this.#observableOwners.set(session, key);
                }
            }
            return session;
        } finally {
            if (admission === 'snapshot') this.#openingSnapshots--;
            else {
                context.signal.removeEventListener('abort', releaseOwner);
                releaseOwner();
                this.#openingObservableSessions--;
            }
        }
    }

}
