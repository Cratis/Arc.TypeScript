// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Subscriber } from 'rxjs';

/** Single-flight observation with an adoptable, retained initial snapshot. */
export class DrizzleObservationSession<T> {
    #release?: () => void;
    #subscriber?: Subscriber<T>;
    #dirty = false;
    #running = false;
    #closed = false;
    #hasValue = false;
    readonly #cancellations = new Set<(reason: Error) => void>();
    readonly #initial: Promise<T>;

    constructor(private readonly read: () => Promise<T>, listen: (changed: () => void) => () => void,
        private readonly signal: AbortSignal | undefined, private readonly onClose: () => void) {
        if (signal?.aborted) {
            this.#closed = true;
            this.#initial = Promise.reject(new Error('Drizzle observation was closed'));
            void this.#initial.catch(() => {});
            return;
        }
        this.#release = listen(() => {
            if (this.#closed) return;
            this.#dirty = true;
            if (this.#subscriber) void this.pump();
        });
        signal?.addEventListener('abort', this.abort, { once: true });
        this.#initial = this.read().then(value => {
            if (this.#closed) throw new Error('Drizzle observation was closed');
            this.#hasValue = true;
            return value;
        }, error => {
            if (!this.#closed) this.release();
            throw error;
        });
        void this.#initial.catch(() => {});
    }

    get closed(): boolean { return this.#closed; }

    async current(): Promise<{ hasValue: true; value: T }> {
        if (this.#closed) throw new Error('Drizzle observation was closed');
        let cancel!: (reason: Error) => void;
        const canceled = new Promise<never>((_, reject) => { cancel = reject; });
        this.#cancellations.add(cancel);
        try {
            const value = await Promise.race([this.#initial, canceled]);
            if (this.#closed) throw new Error('Drizzle observation was closed');
            return { hasValue: true, value };
        } finally { this.#cancellations.delete(cancel); }
    }

    adopt(subscriber: Subscriber<T>): void {
        if (this.#closed) { subscriber.complete(); return; }
        this.#subscriber = subscriber;
        void this.#initial.then(value => {
            if (this.#closed || subscriber.closed) return;
            subscriber.next(value);
            if (this.#dirty) void this.pump();
        }, error => {
            if (!this.#closed && !subscriber.closed) subscriber.error(error);
            this.close();
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

    private readonly abort = (): void => { this.close(); };

    private release(): void {
        this.#release?.();
        this.#release = undefined;
        this.signal?.removeEventListener('abort', this.abort);
    }

    close(): void {
        if (this.#closed) return;
        this.#closed = true;
        this.release();
        for (const cancel of this.#cancellations) cancel(new Error('Drizzle observation was closed'));
        this.#cancellations.clear();
        this.#subscriber?.complete();
        this.onClose();
    }
}
