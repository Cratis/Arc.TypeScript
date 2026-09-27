// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncResource } from 'node:async_hooks';
import type { Subscriber } from 'rxjs';
import type { DrizzleObservationLease } from './DrizzleObservationLease.js';

/** Single-flight observation with an adoptable, retained initial snapshot. */
export class DrizzleObservationSession<T> {
    #release?: () => void;
    #subscriber?: Subscriber<T>;
    #dirty = false;
    #running = false;
    #closed = false;
    #hasValue = false;
    #scheduled = false;
    #released = false;
    #error?: Error;
    readonly #readContext = new AsyncResource('DrizzleObservation');
    readonly #cancellations = new Set<(reason: Error) => void>();
    readonly #initial: Promise<T>;

    constructor(private readonly read: () => Promise<T>, listen: (changed: () => void, fail: (error: Error) => void) => DrizzleObservationLease | (() => void),
        private readonly signal: AbortSignal | undefined, private readonly onClose: () => void) {
        if (signal?.aborted) {
            this.#closed = true;
            this.#initial = Promise.reject(new Error('Drizzle observation was closed'));
            void this.#initial.catch(() => {});
            return;
        }
        signal?.addEventListener('abort', this.abort, { once: true });
        let lease: DrizzleObservationLease | (() => void);
        try {
            lease = listen(() => {
                if (this.#closed) return;
                this.#dirty = true;
                if (this.#subscriber) this.schedule();
            }, error => this.fail(error));
        } catch (error) {
            // The session never started, so its owner has nothing to release.
            signal?.removeEventListener('abort', this.abort);
            this.#closed = true;
            throw error;
        }
        this.#release = typeof lease === 'function' ? lease : () => lease.release();
        if (this.#closed) this.#release();
        const initialRead = typeof lease === 'function' ? this.read() : lease.ready.then(() => {
            if (this.#closed) throw this.#error ?? new Error('Drizzle observation was closed');
            return this.read();
        });
        this.#initial = initialRead.then(value => {
            if (this.#closed) throw this.#error ?? new Error('Drizzle observation was closed');
            this.#hasValue = true;
            return value;
        }).catch(error => {
            if (!this.#closed) this.fail(error instanceof Error ? error : new Error(String(error)));
            throw this.#error ?? error;
        });
        void this.#initial.catch(() => {});
    }

    get closed(): boolean { return this.#closed; }

    async current(): Promise<{ hasValue: true; value: T }> {
        if (this.#closed) throw this.#error ?? new Error('Drizzle observation was closed');
        let cancel!: (reason: Error) => void;
        const canceled = new Promise<never>((_, reject) => { cancel = reject; });
        this.#cancellations.add(cancel);
        try {
            const value = await Promise.race([this.#initial, canceled]);
            if (this.#closed) throw this.#error ?? new Error('Drizzle observation was closed');
            return { hasValue: true, value };
        } finally { this.#cancellations.delete(cancel); }
    }

    adopt(subscriber: Subscriber<T>): void {
        if (this.#error) { subscriber.error(this.#error); return; }
        if (this.#closed) { subscriber.complete(); return; }
        this.#subscriber = subscriber;
        void this.#initial.then(value => {
            if (this.#closed || subscriber.closed) return;
            subscriber.next(value);
            if (this.#dirty) this.schedule();
        }, error => {
            if (!subscriber.closed) subscriber.error(this.#error ?? error);
            this.close();
        });
    }

    private schedule(): void {
        if (this.#scheduled || this.#running || this.#closed) return;
        this.#scheduled = true;
        setImmediate(() => {
            this.#scheduled = false;
            if (!this.#closed) this.#readContext.runInAsyncScope(() => { void this.pump(); });
        });
    }

    private async pump(): Promise<void> {
        if (this.#running || this.#closed || !this.#hasValue || !this.#subscriber) return;
        this.#running = true;
        try {
            while (this.#dirty && !this.#closed) {
                this.#dirty = false;
                const value = await this.read();
                if (this.#closed) break;
                this.#subscriber?.next(value);
            }
        } catch (error) {
            if (!this.#closed) { this.#subscriber?.error(error); this.close(); }
        } finally { this.#running = false; }
    }

    /** Retain a terminal source error across a prime/current and a later adoption. */
    fail(error: Error): void {
        if (this.#closed) return;
        this.#error = error;
        this.#closed = true;
        this.release();
        for (const cancel of this.#cancellations) cancel(error);
        this.#cancellations.clear();
        this.#subscriber?.error(error);
    }

    private readonly abort = (): void => { this.close(); };

    private release(): void {
        if (this.#released) return;
        this.#released = true;
        this.#release?.();
        this.#release = undefined;
        this.signal?.removeEventListener('abort', this.abort);
        this.#readContext.emitDestroy();
        this.onClose();
    }

    close(): void {
        if (this.#closed) return;
        this.#closed = true;
        this.release();
        for (const cancel of this.#cancellations) cancel(new Error('Drizzle observation was closed'));
        this.#cancellations.clear();
        this.#subscriber?.complete();
    }
}
