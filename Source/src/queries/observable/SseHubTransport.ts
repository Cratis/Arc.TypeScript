// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { HubFrame } from './HubFrame.js';
import type { HubTransport } from './HubTransport.js';
import { ObservableTransportError } from './ObservableTransportError.js';

interface QueuedFrame {
    readonly frame: HubFrame;
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

    constructor() {
        this.body = new ReadableStream<Uint8Array>({
            start: controller => { this.#stream = controller; },
            pull: async controller => {
                if (this.signal.aborted) return;
                if (!this.#queue.length) await new Promise<void>(resolve => { this.#wake = resolve; });
                if (this.signal.aborted) return;
                const queued = this.#queue.shift();
                if (!queued) return;
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(queued.frame)}\n\n`));
                    this.#lastActivity = Date.now();
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

    send(frame: HubFrame): Promise<void> {
        if (this.signal.aborted) return Promise.reject(new Error('Observable SSE hub connection is closed'));
        if (this.#queue.length >= 64) {
            this.close();
            return Promise.reject(new ObservableTransportError('Observable SSE hub outbound queue is full'));
        }
        return new Promise<void>((resolve, reject) => {
            this.#queue.push({ frame, resolve, reject });
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
