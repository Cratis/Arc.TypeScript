// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcOptions } from '../../ArcOptions.js';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';
import type { QueryOptions } from '../QueryOptions.js';
import type { Operation } from '../../http/Operation.js';
import type { ServiceRegistry } from '../../dependencyInjection/ServiceRegistry.js';
import { ObservableQuerySession } from './ObservableQuerySession.js';
import { ObservableSubscriptionLimitError } from './ObservableSubscriptionLimitError.js';
import { isObservableOperation } from './ObservableOperation.js';
import { observableCallerKey } from './observableCallerKey.js';
import type { ObservableLimits } from './ObservableLimits.js';
import { exposeExceptionDetails } from '../../execution/exposeExceptionDetails.js';
import type { ShutdownTransaction } from '../../dependencyInjection/ShutdownTransaction.js';

export class ObservableSessions {
    readonly #observableSessions = new Set<ObservableQuerySession>();
    readonly #snapshotSessions = new Set<ObservableQuerySession>();
    readonly #retiringSessions = new Set<ObservableQuerySession>();
    readonly #openingSessions = new Set<ObservableQuerySession>();
    readonly #releasedOpening = new Set<ObservableQuerySession>();
    #transaction: ShutdownTransaction | undefined;
    readonly #observableOwners = new Map<ObservableQuerySession, string>();
    readonly #openingOwners = new Map<string, number>();
    readonly #reportedCleanup = new WeakSet<object>();
    #openingObservableSessions = 0;
    #openingSnapshots = 0;
    #disposed = false;

    constructor(private readonly options: ArcOptions, private readonly services: ServiceRegistry,
        private readonly observableLimits: ObservableLimits, private readonly queries: () => ReadonlyMap<string, Operation>) {}

    get sessions(): readonly ObservableQuerySession[] {
        return [...new Set([...this.#observableSessions, ...this.#snapshotSessions, ...this.#retiringSessions])];
    }
    /** @internal Every session a shutdown transaction owns, including those still opening. */
    get coordinatedSessions(): readonly ObservableQuerySession[] {
        return [...new Set([...this.#openingSessions, ...this.#releasedOpening, ...this.sessions])];
    }
    recordCleanupFailure(session: object): boolean {
        if (this.#reportedCleanup.has(session)) return false;
        this.#reportedCleanup.add(session);
        return true;
    }
    markDisposed(): void { this.#disposed = true; }
    /** @internal Coordinate opening, active and retiring records before asynchronous teardown. */
    coordinateShutdown(transaction: ShutdownTransaction): void {
        this.#transaction = transaction;
        this.markDisposed();
        for (const session of this.coordinatedSessions) session.coordinateShutdown(transaction);
    }

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
        const operation = this.queries().get(name);
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
            const held: { session?: ObservableQuerySession; opening?: ObservableQuerySession } = {};
            const session = await ObservableQuerySession.open({
                operation, input, context, options, services: this.services,
                guards: this.options.query?.observableEmissionGuards ?? [],
                exposeExceptionDetails: exposeExceptionDetails(this.options),
                pendingEmissions: this.observableLimits.pendingEmissions,
                reportFailure: error => Promise.resolve(this.options.logger?.(error, context.correlationId)),
                onCreate: session => {
                    // Opening sessions are visible only to coordinated shutdown.
                    held.opening = session;
                    this.#openingSessions.add(session);
                    if (this.#transaction) session.coordinateShutdown(this.#transaction);
                },
                onRelease: () => {
                    if (!held.session) {
                        if (held.opening) this.#releasedOpening.add(held.opening);
                        return;
                    }
                    this.#observableSessions.delete(held.session);
                    this.#snapshotSessions.delete(held.session);
                    this.#observableOwners.delete(held.session);
                    this.#retiringSessions.add(held.session);
                },
                onClose: () => {
                    if (held.opening) {
                        this.#openingSessions.delete(held.opening);
                        this.#releasedOpening.delete(held.opening);
                    }
                    if (!held.session) return;
                    this.#observableSessions.delete(held.session);
                    this.#snapshotSessions.delete(held.session);
                    this.#observableOwners.delete(held.session);
                    this.#retiringSessions.delete(held.session);
                }
            });
            held.session = session;
            this.#openingSessions.delete(session);
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
