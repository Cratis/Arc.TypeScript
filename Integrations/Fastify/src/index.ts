// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { TLSSocket } from 'node:tls';
import type { IncomingMessage } from 'node:http';
import { attachNodeWebSockets } from '@cratis/arc.server';
import type { ArcServer, NativeRequestContext } from '@cratis/arc.server';

const origin = 'http://arc.invalid';
/** The callback must use host-verified identity/authority, never request headers. */
export function mountFastify(app: FastifyInstance, server: ArcServer, native?: (request: FastifyRequest) => Omit<NativeRequestContext, 'secure'>): void {
    // Encapsulated parsers never replace the parent application's content-type behavior.
    app.register(async scoped => {
        scoped.removeAllContentTypeParsers();
        scoped.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, payload, done) => done(null, payload));
        async function dispatch(request: FastifyRequest, reply: FastifyReply, path: string) {
            const rawPath = request.raw.url?.split('?')[0];
            if (rawPath !== path) return reply.code(404).send();
            const controller = new AbortController();
            let streaming = false;
            const abort = () => controller.abort();
            const onClose = () => { if (!reply.raw.writableEnded) abort(); };
            request.raw.on('aborted', abort);
            reply.raw.on('close', onClose);
            try {
                const payload = request.body;
                const body = Buffer.isBuffer(payload) ? new Uint8Array(payload) : undefined;
                const incoming = new Request(new URL(request.raw.url ?? path, origin), {
                    method: request.method, headers: new Headers(request.headers as Record<string, string>),
                    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
                    signal: controller.signal
                });
                const result = await server.handle(incoming, () => ({ ...native?.(request), secure: request.raw.socket instanceof TLSSocket && request.raw.socket.encrypted === true }));
                if (!result) return reply.code(404).send();
                // Fastify appends Set-Cookie to existing hook cookies itself.
                result.headers.forEach((value, key) => reply.header(key, value));
                if (result.headers.get('content-type')?.startsWith('text/event-stream')) {
                    if (!result.body) throw new Error('Observable query stream has no response body');
                    streaming = true;
                    reply.raw.once('close', () => {
                        request.raw.off('aborted', abort);
                        reply.raw.off('close', onClose);
                    });
                    return reply.code(result.status).send(Readable.fromWeb(result.body as unknown as NodeReadableStream));
                }
                return reply.code(result.status).send(await result.text());
            } finally {
                if (!streaming) {
                    request.raw.off('aborted', abort);
                    reply.raw.off('close', onClose);
                }
            }
        }
        for (const path of server.endpoints.keys()) {
            scoped.route({ method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', ...(server.routes.has(path) ? ['QUERY' as const] : [])], url: path,
                handler: (request, reply) => dispatch(request, reply, path) });
        }
    });
}

/** Bridge upgrades on Fastify's Node server without replacing its HTTP routing. */
export function mountFastifyWebSockets(app: FastifyInstance, server: ArcServer,
    native?: (request: IncomingMessage) => Omit<NativeRequestContext, 'secure'>): () => Promise<void> {
    return attachNodeWebSockets(app.server, server, native);
}
