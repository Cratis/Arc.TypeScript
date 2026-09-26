// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Observable } from 'rxjs';
import { DrizzleObservationSession } from './DrizzleObservationSession.js';

/** Experimental lazy SQL observation; call current() for a snapshot or subscribe for changes. */
export class DrizzleObservable<T> extends Observable<T> {
    #prime?: DrizzleObservationSession<T>;
    #closed = false;
    readonly #sessions = new Set<DrizzleObservationSession<T>>();

    constructor(private readonly open: (onClose: () => void) => DrizzleObservationSession<T>,
        private readonly canStart: () => void, private readonly onActive: () => void = () => {},
        private readonly onIdle: () => void = () => {}) {
        super(subscriber => {
            if (this.#closed) { subscriber.complete(); return; }
            try { this.canStart(); }
            catch (error) { subscriber.error(error); return; }
            const session = this.#prime ?? this.start();
            this.#prime = undefined;
            session.adopt(subscriber);
            return () => session.close();
        });
    }

    private start(): DrizzleObservationSession<T> {
        this.canStart();
        const session = this.open(() => {
            this.#sessions.delete(session);
            if (!this.#sessions.size) this.onIdle();
        });
        this.#sessions.add(session);
        this.onActive();
        return session;
    }

    /** Prime one listener before reading; the first subscription adopts that snapshot. */
    current(): Promise<{ hasValue: true; value: T }> {
        if (this.#closed) return Promise.reject(new Error('Drizzle observation was closed'));
        try { this.#prime ??= this.start(); return this.#prime.current(); }
        catch (error) { return Promise.reject(error); }
    }

    /** Release an unused prime or active subscriptions. */
    close(): void {
        if (this.#closed) return;
        this.#closed = true;
        for (const session of [...this.#sessions]) session.close();
        this.#prime = undefined;
    }
}
