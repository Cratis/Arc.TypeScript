// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import WebSocket from 'ws';

/** Bounded, backpressure-aware bridge from a Node WebSocket to core protocol handlers. */
export class WebSocketTransport implements AsyncIterable<string> {
    readonly #controller = new AbortController();
    readonly #pending: string[] = [];
    #wake: (() => void) | undefined;
    #outstanding = 0;
    #lastActivity = Date.now();
    #sendTail: Promise<void> = Promise.resolve();

    constructor(readonly socket: WebSocket) {
        socket.on('message', (data, binary) => {
            if (binary || this.#pending.length >= 64) { this.close(); return; }
            this.#pending.push(data.toString());
            this.#wake?.();
            this.#wake = undefined;
        });
        socket.on('close', () => this.close());
        socket.on('error', () => this.close());
    }

    get signal(): AbortSignal { return this.#controller.signal; }
    get lastActivity(): number { return this.#lastActivity; }

    /** Enqueue one frame; a failed or overloaded write closes the entire connection. */
    send(value: unknown): Promise<void> {
        if (this.signal.aborted || ++this.#outstanding > 64) {
            this.close();
            return Promise.reject(new Error('Observable WebSocket outbound queue is full or closed'));
        }
        const json = JSON.stringify(value);
        if (Buffer.byteLength(json) > 1024 * 1024) {
            this.close();
            return Promise.reject(new Error('Observable WebSocket frame exceeds maximum size'));
        }
        const written = this.#sendTail.then(() => this.write(json)).catch(error => {
            this.close();
            throw error;
        });
        this.#sendTail = written.catch(() => {});
        return written.finally(() => { this.#outstanding--; });
    }

    private async write(json: string): Promise<void> {
        if (this.signal.aborted || this.socket.readyState !== WebSocket.OPEN || this.socket.bufferedAmount > 1024 * 1024) {
            this.close();
            throw new Error('Observable WebSocket is closed or backpressured');
        }
        await new Promise<void>((resolve, reject) => this.socket.send(json, error => error ? reject(error) : resolve()));
        this.#lastActivity = Date.now();
    }

    /** Cancel pending reads and writes; idempotent on disconnect or shutdown. */
    close(): void {
        if (this.signal.aborted) return;
        this.#controller.abort();
        this.#wake?.();
        this.#wake = undefined;
        if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
        else if (this.socket.readyState === WebSocket.CONNECTING) this.socket.terminate();
    }

    async *[Symbol.asyncIterator](): AsyncGenerator<string> {
        try {
            while (!this.signal.aborted) {
                if (this.#pending.length) { yield this.#pending.shift()!; continue; }
                await new Promise<void>(resolve => { this.#wake = resolve; });
            }
        } finally { this.close(); }
    }
}
