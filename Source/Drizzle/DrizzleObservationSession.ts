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
    #catchup = false;
    #running = false;
    #closed = false;
    #hasValue = false;
    #scheduled = false;
    #released = false;
    #error?: Error;
    #lease?: DrizzleObservationLease;
    #snapshot?: T;
    #emitted = false;
    #pumpPromise?: Promise<void>;
    #readFinished?: Promise<void>;
    #finishRead?: () => void;
    #catchupFinished?: Promise<void>;
    #finishCatchup?: () => void;
    readonly #readContext = new AsyncResource('DrizzleObservation');
    readonly #cancellations = new Set<(reason: Error) => void>();
    readonly #initial: Promise<T>;

    constructor(private readonly read: () => Promise<T>, listen: (changed: (catchup?: boolean) => void, fail: (error: Error) => void,
        complete: () => void) => DrizzleObservationLease | (() => void),
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
            lease = listen((catchup = false) => {
                if (this.#closed) return;
                this.#dirty = true;
                if (catchup) {
                    this.#catchup = true;
                    if (!this.#catchupFinished) this.#catchupFinished = new Promise<void>(resolve => { this.#finishCatchup = resolve; });
                }
                if (this.#subscriber || catchup) this.schedule();
            }, error => this.fail(error), () => this.close());
        } catch (error) {
            // The session never started, so its owner has nothing to release.
            signal?.removeEventListener('abort', this.abort);
            this.#closed = true;
            throw error;
        }
        this.#lease = typeof lease === 'function' ? undefined : lease;
        this.#release = typeof lease === 'function' ? lease : () => lease.release();
        if (this.#closed) this.#release();
        const initialRead = typeof lease === 'function' ? this.read() : lease.ready.then(() => this.readSnapshot());
        this.#initial = initialRead.then(value => {
            if (this.#closed) throw this.#error ?? new Error('Drizzle observation was closed');
            this.#hasValue = true;
            this.#snapshot = value;
            if (this.#dirty && (this.#subscriber || this.#catchup)) this.schedule();
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
            await Promise.race([this.#initial, canceled]);
            if (this.#lease?.whenReady) await Promise.race([this.#lease.whenReady(), canceled]);
            if (this.#catchup || (this.#lease?.whenReady && (this.#running || this.#dirty))) {
                void this.pump();
                await Promise.race([this.#catchupFinished ?? this.#readFinished ?? Promise.resolve(), canceled]);
            }
            if (this.#closed) throw this.#error ?? new Error('Drizzle observation was closed');
            return { hasValue: true, value: this.#snapshot! };
        } finally { this.#cancellations.delete(cancel); }
    }

    adopt(subscriber: Subscriber<T>): void {
        if (this.#error) { subscriber.error(this.#error); return; }
        if (this.#closed) { subscriber.complete(); return; }
        this.#subscriber = subscriber;
        void this.#initial.then(async () => {
            if (this.#lease?.whenReady) await this.#lease.whenReady();
            if (this.#catchup || (this.#lease?.whenReady && (this.#running || this.#dirty))) {
                void this.pump();
                await (this.#catchupFinished ?? this.#readFinished);
            }
            if (this.#closed || subscriber.closed) return;
            this.#emitted = true;
            subscriber.next(this.#snapshot!);
            if (this.#dirty) this.schedule();
        }).catch(error => {
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

    private async readSnapshot(): Promise<T> {
        while (true) {
            if (this.#closed) throw this.#error ?? new Error('Drizzle observation was closed');
            const generation = await this.#lease?.whenReady?.();
            if (this.#closed) throw this.#error ?? new Error('Drizzle observation was closed');
            let value: T;
            try { value = await this.read(); }
            catch (error) {
                if (generation !== undefined && this.#lease?.isCurrent?.(generation) === false) continue;
                throw error;
            }
            if (this.#closed) throw this.#error ?? new Error('Drizzle observation was closed');
            if (generation === undefined || this.#lease?.isCurrent?.(generation) !== false) return value;
            // A read racing a lost connection cannot replace a retained snapshot.
        }
    }

    private pump(): Promise<void> {
        if (this.#pumpPromise) return this.#pumpPromise;
        if (this.#closed || !this.#hasValue || !this.#dirty) return Promise.resolve();
        this.#running = true;
        this.#pumpPromise = (async () => {
            try {
                while (this.#dirty && !this.#closed) {
                    this.#dirty = false;
                    const catchingUp = this.#catchup;
                    this.#readFinished = new Promise<void>(resolve => { this.#finishRead = resolve; });
                    try {
                        const value = await this.readSnapshot();
                        if (this.#closed) break;
                        this.#snapshot = value;
                        if (catchingUp) {
                            this.#catchup = false;
                            this.#finishCatchup?.();
                            this.#catchupFinished = undefined;
                            this.#finishCatchup = undefined;
                        }
                        if (this.#emitted) this.#subscriber?.next(value);
                    } finally {
                        this.#finishRead?.();
                        this.#readFinished = undefined;
                        this.#finishRead = undefined;
                    }
                }
            } catch (error) {
                if (!this.#closed) this.fail(error instanceof Error ? error : new Error(String(error)));
            } finally { this.#running = false; this.#pumpPromise = undefined; }
        })();
        return this.#pumpPromise;
    }

    /** Retain a terminal source error across a prime/current and a later adoption. */
    fail(error: Error): void {
        if (this.#closed) return;
        this.#error = error;
        this.#closed = true;
        this.#catchup = false;
        this.#finishCatchup?.();
        this.#catchupFinished = undefined;
        this.#finishCatchup = undefined;
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
        this.#catchup = false;
        this.#finishCatchup?.();
        this.#catchupFinished = undefined;
        this.#finishCatchup = undefined;
        this.release();
        for (const cancel of this.#cancellations) cancel(new Error('Drizzle observation was closed'));
        this.#cancellations.clear();
        this.#subscriber?.complete();
    }
}
