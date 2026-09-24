// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Browser-like EventSource backed by real fetch for Node client-contract tests. */
export class FetchEventSource {
    static OPEN = 1;
    static CLOSED = 2;
    readyState = 0;
    onmessage;
    onopen;
    onerror;
    #abort = new AbortController();

    constructor(url, headers = {}) { void this.#read(url, headers); }

    async #read(url, headers) {
        try {
            const response = await fetch(url, {
                headers: { accept: 'text/event-stream', ...headers }, signal: this.#abort.signal
            });
            if (!response.ok) throw Error(`SSE response ${response.status}`);
            this.readyState = FetchEventSource.OPEN;
            this.onopen?.();
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (!this.#abort.signal.aborted) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                for (;;) {
                    const end = buffer.indexOf('\n\n');
                    if (end === -1) break;
                    const frame = buffer.slice(0, end);
                    buffer = buffer.slice(end + 2);
                    if (frame.startsWith('data: ')) this.onmessage?.({ data: frame.slice(6) });
                }
            }
        } catch (error) {
            if (!this.#abort.signal.aborted) this.onerror?.(error);
        } finally { this.readyState = FetchEventSource.CLOSED; }
    }

    close() { this.readyState = FetchEventSource.CLOSED; this.#abort.abort(); }
}
