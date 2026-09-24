// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { QueryResult } from '../../QueryResult.js';
import type { ObservableQuerySession } from './ObservableQuerySession.js';

const encoder = new TextEncoder();

/** Direct SSE frames contain query results, not hub envelopes. */
export function directSse(session: ObservableQuerySession, headers: Headers): Response {
    headers.set('content-type', 'text/event-stream; charset=utf-8');
    headers.set('cache-control', 'no-cache');
    headers.set('connection', 'keep-alive');
    headers.set('x-accel-buffering', 'no');
    const iterator = session.results();
    let pending: Promise<IteratorResult<QueryResult>> | undefined;
    let closed = false;
    const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
            if (closed) return;
            pending ??= iterator.next();
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                const outcome = await Promise.race([
                    pending.then(value => ({ kind: 'result' as const, value })),
                    new Promise<{ kind: 'keepalive' }>(resolve => {
                        timer = setTimeout(() => resolve({ kind: 'keepalive' }), 15_000);
                    })
                ]);
                if (closed) return;
                if (outcome.kind === 'keepalive') {
                    controller.enqueue(encoder.encode(': keepalive\n\n'));
                    return;
                }
                pending = undefined;
                if (outcome.value.done) { closed = true; controller.close(); return; }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(outcome.value.value)}\n\n`));
                if (!outcome.value.value.isAuthorized || outcome.value.value.hasExceptions || !outcome.value.value.isValid) {
                    closed = true;
                    await session.close();
                    await iterator.return(undefined);
                    controller.close();
                }
            } catch (error) {
                closed = true;
                try { controller.error(error); }
                finally {
                    try { await session.reportTransportFailure(error); }
                    finally { await session.close(); }
                }
            } finally {
                if (timer) clearTimeout(timer);
            }
        },
        async cancel() {
            closed = true;
            try { await session.close(); }
            finally { await iterator.return(undefined); }
        }
    });
    return new Response(body, { status: 200, headers });
}
