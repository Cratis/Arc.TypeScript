// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ChangeStream, Document } from 'mongodb';

/** One subscription owns one change stream; every change recomputes a complete snapshot. */
export class MongoObservation<T> implements AsyncIterable<T> {
    readonly #abort: () => void;
    #closed = false;
    #used = false;
    #closing?: Promise<void>;
    constructor(private readonly stream: ChangeStream<Document>, private readonly read: () => Promise<T>,
        private readonly initial: T, signal: AbortSignal, private readonly release: () => void) {
        this.#signal = signal;
        this.#abort = () => { void this.close().catch(() => { /* Scope disposal reports the same failure. */ }); };
        signal.addEventListener('abort', this.#abort, { once: true });
        if (signal.aborted) this.#abort();
    }
    readonly #signal: AbortSignal;
    /** The initial value is available to an ordinary Arc snapshot GET. */
    current(): { hasValue: true; value: T } { return { hasValue: true, value: this.initial }; }
    async *[Symbol.asyncIterator](): AsyncGenerator<T> {
        if (this.#used) throw new Error('MongoDB observation already consumed');
        this.#used = true;
        try {
            yield this.initial;
            while (!this.#closed && !this.#signal.aborted) {
                const change = await this.stream.next();
                if (!change || this.#closed || this.#signal.aborted) break;
                yield await this.read();
            }
            if (!this.#closed && !this.#signal.aborted) throw new Error('MongoDB change stream ended');
        } finally { await this.close(); }
    }
    /** Close the cursor on subscription disposal even when no iterator was opened. */
    close(): Promise<void> {
        if (this.#closing) return this.#closing;
        this.#closed = true;
        this.#signal.removeEventListener('abort', this.#abort);
        this.#closing = this.stream.close().finally(this.release);
        return this.#closing;
    }
}
