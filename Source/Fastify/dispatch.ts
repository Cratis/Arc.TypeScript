// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { TLSSocket } from 'node:tls';
import type { ArcServer, NativeRequestContext } from '@cratis/arc.core';

const origin = 'http://arc.invalid';

function incomingRequest(request: FastifyRequest, path: string, expected: string, signal: AbortSignal): Request | undefined {
    const payload = request.body;
    const body = Buffer.isBuffer(payload) ? new Uint8Array(payload) : undefined;
    const raw = request.raw.url ?? expected;
    const url = new URL(raw, origin);
    if (url.origin !== origin || url.pathname !== expected) return undefined;
    return new Request(new URL(`${path}${url.search}`, origin), {
        method: request.method, headers: new Headers(request.headers as Record<string, string>),
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
        signal
    });
}

function sendReply(result: Response, reply: FastifyReply, streams: Set<{ abort(): void }>,
    controller: AbortController, release: () => void, markStreaming: () => void): Promise<FastifyReply> | FastifyReply {
    // Fastify appends Set-Cookie to existing hook cookies itself.
    result.headers.forEach((value, key) => reply.header(key, value));
    if (result.headers.get('content-type')?.startsWith('text/event-stream')) {
        if (!result.body) throw new Error('Observable query stream has no response body');
        markStreaming();
        const stream = { abort: () => { controller.abort(); reply.raw.destroy(); } };
        streams.add(stream);
        reply.raw.once('close', () => { streams.delete(stream); release(); });
        return reply.code(result.status).send(Readable.fromWeb(result.body as unknown as NodeReadableStream));
    }
    return result.text().then(text => reply.code(result.status).send(text));
}

/** Forward one Fastify request into the Fetch host and preserve streaming cleanup. */
export function createDispatcher(server: ArcServer, prefix: string,
    native: ((request: FastifyRequest) => NativeRequestContext | Promise<NativeRequestContext>) | undefined,
    streams: Set<{ abort(): void }>): (request: FastifyRequest, reply: FastifyReply, path: string) => Promise<FastifyReply> {
    return async (request, reply, path) => {
        const rawPath = request.raw.url?.split('?')[0];
        const expected = `${prefix.replace(/\/$/, '')}${path}`;
        if (rawPath !== expected) return reply.code(404).send();
        const controller = new AbortController();
        let streaming = false;
        const abort = () => controller.abort();
        const onClose = () => { if (!reply.raw.writableEnded) abort(); };
        request.raw.on('aborted', abort);
        reply.raw.on('close', onClose);
        try {
            const incoming = incomingRequest(request, path, expected, controller.signal);
            if (!incoming) return reply.code(400).send();
            const result = await server.handle(incoming, async () => {
                const verified = await native?.(request);
                return { ...verified, remoteAddress: verified?.remoteAddress ?? request.raw.socket.remoteAddress,
                    secure: verified?.secure ?? (request.raw.socket instanceof TLSSocket && request.raw.socket.encrypted === true) };
            });
            if (!result) return reply.code(404).send();
            return await sendReply(result, reply, streams, controller, () => {
                request.raw.off('aborted', abort);
                reply.raw.off('close', onClose);
            }, () => { streaming = true; });
        } finally {
            if (!streaming) {
                request.raw.off('aborted', abort);
                reply.raw.off('close', onClose);
            }
        }
    };
}
