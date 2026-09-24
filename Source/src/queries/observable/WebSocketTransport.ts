// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import WebSocket from 'ws';
import { ObservableTransportError } from './ObservableTransportError.js';
import { ObservableLimits } from './ObservableLimits.js';

/** Bounded, backpressure-aware bridge from a Node WebSocket to core protocol handlers. */
export class WebSocketTransport implements AsyncIterable<string> {
    readonly #controller = new AbortController();
    readonly #pending: string[] = [];
    #wake: (() => void) | undefined;
    #outstanding = 0;
    #lastActivity = Date.now();
    #activity: (() => void) | undefined;
    #sendTail: Promise<void> = Promise.resolve();

    constructor(readonly socket: WebSocket, readonly limits: ObservableLimits = new ObservableLimits({})) {
        socket.on('message', (data, binary) => {
            if (binary) { this.close(1008, 'Text frames required'); return; }
            if (this.#pending.length >= this.limits.inboundFrames) { this.close(1013, 'Inbound queue full'); return; }
            this.#pending.push(data.toString());
            this.#wake?.();
            this.#wake = undefined;
        });
        socket.on('close', () => this.close());
        socket.on('error', () => this.close());
    }

    get signal(): AbortSignal { return this.#controller.signal; }
    get lastActivity(): number { return this.#lastActivity; }
    onActivity(callback: () => void): () => void {
        this.#activity = callback;
        return () => { if (this.#activity === callback) this.#activity = undefined; };
    }

    /** Enqueue one frame; a failed or overloaded write closes the entire connection. */
    send(value: unknown): Promise<void> {
        if (this.signal.aborted) return Promise.reject(new Error('Observable WebSocket is closed'));
        if (this.#outstanding >= this.limits.outboundFrames) {
            this.close(1013, 'Outbound queue full');
            return Promise.reject(new ObservableTransportError('Observable WebSocket outbound queue is full'));
        }
        this.#outstanding++;
        let json: string;
        try {
            const serialized = JSON.stringify(value);
            if (typeof serialized !== 'string' || Buffer.byteLength(serialized) > this.limits.outboundFrameBytes)
                throw new ObservableTransportError('Observable WebSocket frame exceeds maximum size');
            json = serialized;
        } catch (error) {
            this.#outstanding--;
            this.close(1008, 'Invalid outbound frame');
            return Promise.reject(error instanceof ObservableTransportError ? error :
                new ObservableTransportError('Observable WebSocket serialization failed', { cause: error }));
        }
        const written = this.#sendTail.then(() => this.write(json)).catch(error => {
            this.close();
            throw error;
        });
        this.#sendTail = written.catch(() => {});
        return written.finally(() => { this.#outstanding--; });
    }

    private async write(json: string): Promise<void> {
        if (this.signal.aborted || this.socket.readyState !== WebSocket.OPEN)
            throw new Error('Observable WebSocket is closed');
        if (this.socket.bufferedAmount > this.limits.outboundFrameBytes) {
            this.close(1013, 'Write backpressure');
            throw new ObservableTransportError('Observable WebSocket is backpressured');
        }
        await new Promise<void>((resolve, reject) => {
            const cancel = (): void => reject(new Error('Observable WebSocket disconnected during write'));
            this.signal.addEventListener('abort', cancel, { once: true });
            try {
                this.socket.send(json, error => {
                    this.signal.removeEventListener('abort', cancel);
                    if (error) reject(new ObservableTransportError('Observable WebSocket write failed', { cause: error }));
                    else if (this.signal.aborted) cancel();
                    else resolve();
                });
            } catch (error) {
                this.signal.removeEventListener('abort', cancel);
                reject(new ObservableTransportError('Observable WebSocket write failed', { cause: error }));
            }
        });
        this.#lastActivity = Date.now();
        this.#activity?.();
    }

    /** Cancel pending reads and writes; idempotent on disconnect or shutdown. */
    close(code = 1000, reason = ''): void {
        if (this.signal.aborted) return;
        this.#controller.abort();
        this.#wake?.();
        this.#wake = undefined;
        if (this.socket.readyState === WebSocket.OPEN) this.socket.close(code, reason);
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
