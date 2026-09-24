// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { HubFrame } from './HubFrame.js';
import type { HubTransport } from './HubTransport.js';
import { ObservableTransportError } from './ObservableTransportError.js';
import { ObservableLimits } from './ObservableLimits.js';

interface QueuedFrame {
    readonly data: string;
    readonly resolve: () => void;
    readonly reject: (reason: unknown) => void;
}

const encoder = new TextEncoder();

/** A bounded SSE output stream; control messages arrive on separate authenticated POSTs. */
export class SseHubTransport implements HubTransport {
    readonly #controller = new AbortController();
    readonly #queue: QueuedFrame[] = [];
    readonly body: ReadableStream<Uint8Array>;
    #stream: ReadableStreamDefaultController<Uint8Array> | undefined;
    #wake: (() => void) | undefined;
    #lastActivity = Date.now();
    #activity: (() => void) | undefined;

    constructor(readonly limits: ObservableLimits = new ObservableLimits({})) {
        this.body = new ReadableStream<Uint8Array>({
            start: controller => { this.#stream = controller; },
            pull: async controller => {
                if (this.signal.aborted) return;
                if (!this.#queue.length) await new Promise<void>(resolve => { this.#wake = resolve; });
                if (this.signal.aborted) return;
                const queued = this.#queue.shift();
                if (!queued) return;
                try {
                    controller.enqueue(encoder.encode(`data: ${queued.data}\n\n`));
                    this.#lastActivity = Date.now();
                    this.#activity?.();
                    queued.resolve();
                } catch (error) {
                    queued.reject(new ObservableTransportError('Observable SSE hub write failed', { cause: error }));
                    this.close();
                }
            },
            cancel: () => this.close()
        }, { highWaterMark: 1 });
    }

    get signal(): AbortSignal { return this.#controller.signal; }
    get lastActivity(): number { return this.#lastActivity; }
    onActivity(callback: () => void): () => void {
        this.#activity = callback;
        return () => { if (this.#activity === callback) this.#activity = undefined; };
    }

    send(frame: HubFrame): Promise<void> {
        if (this.signal.aborted) return Promise.reject(new Error('Observable SSE hub connection is closed'));
        if (this.#queue.length >= this.limits.outboundFrames) {
            this.close();
            return Promise.reject(new ObservableTransportError('Observable SSE hub outbound queue is full'));
        }
        let data: string;
        try {
            data = JSON.stringify(frame);
            if (Buffer.byteLength(data) > this.limits.outboundFrameBytes)
                throw new ObservableTransportError('Observable SSE hub frame exceeds maximum size');
        } catch (error) {
            this.close();
            return Promise.reject(error instanceof ObservableTransportError ? error :
                new ObservableTransportError('Observable SSE hub serialization failed', { cause: error }));
        }
        return new Promise<void>((resolve, reject) => {
            this.#queue.push({ data, resolve, reject });
            this.#wake?.();
            this.#wake = undefined;
        });
    }

    close(): void {
        if (this.signal.aborted) return;
        this.#controller.abort();
        const failure = new Error('Observable SSE hub connection closed');
        for (const pending of this.#queue.splice(0)) pending.reject(failure);
        this.#wake?.();
        this.#wake = undefined;
        try { this.#stream?.close(); }
        catch { /* Canceling a stream has already closed its controller. */ }
    }
}
