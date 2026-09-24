// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { TLSSocket } from 'node:tls';
import type { ArcServer } from '../ArcServer.js';
import type { ArcNodeOptions } from './ArcNodeOptions.js';

/** Bridge a Node request to Fetch and copy the response, registering live SSE for host shutdown. */
export async function dispatchToArc(
    server: ArcServer, request: IncomingMessage, response: ServerResponse, path: string, search: string,
    signal: AbortSignal, options: ArcNodeOptions, registerStream: (stream: ServerResponse) => void,
    unregisterStream: (stream: ServerResponse) => void
): Promise<void> {
    if (request.method === 'TRACE' || request.method === 'CONNECT') {
        response.writeHead(405, { allow: 'GET, HEAD, POST, QUERY', 'x-content-type-options': 'nosniff' });
        response.end();
        return;
    }
    const body = request.method === 'POST' || request.method === 'QUERY'
        ? Readable.toWeb(request) as ReadableStream<Uint8Array> : undefined;
    const init: RequestInit & { duplex?: 'half' } = {
        method: request.method, headers: new Headers(request.headers as Record<string, string>), body, signal
    };
    if (body) init.duplex = 'half';
    const result = await server.handle(new Request(new URL(path + search, 'http://arc.invalid'), init), () => ({
        ...options.native?.(request), secure: request.socket instanceof TLSSocket && request.socket.encrypted === true
    }));
    if (!result) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' });
        response.end('Not Found');
        return;
    }
    result.headers.forEach((value, key) => {
        if (key === 'set-cookie') response.setHeader(key, result.headers.getSetCookie());
        else response.setHeader(key, value);
    });
    response.statusCode = result.status;
    if (request.method === 'HEAD') { await result.body?.cancel(); response.end(); return; }
    if (result.headers.get('content-type')?.startsWith('text/event-stream')) registerStream(response);
    try {
        if (response.destroyed) { await result.body?.cancel(); return; }
        if (result.body) await pipeline(Readable.fromWeb(result.body as unknown as NodeReadableStream), response);
        else response.end();
    } finally { unregisterStream(response); }
}
