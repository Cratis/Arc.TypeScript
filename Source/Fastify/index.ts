// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { TLSSocket } from 'node:tls';
import { fastifyWebSocketMount, mountFastifyWebSockets } from './WebSocketMount.js';
export { mountFastifyWebSockets } from './WebSocketMount.js';
import type { ArcApplication, ArcServer, NativeRequestContext } from '@cratis/arc.core';

const origin = 'http://arc.invalid';
/** One encapsulated Fastify registration for Arc HTTP and observable upgrades. */
export async function cratisArc(app: FastifyInstance, options: {
    arc: ArcServer | ArcApplication;
    prefix?: string;
    webSockets?: boolean;
    native?: (request: FastifyRequest) => NativeRequestContext | Promise<NativeRequestContext>;
}): Promise<void> {
    const server = 'server' in options.arc ? options.arc.server : options.arc;
    if (options.webSockets !== false) mountFastifyWebSockets(app, server, options.native, options.prefix);
    mountFastify(app, options.arc, options.native, options.prefix);
}

/** @deprecated Use app.register(cratisArc, { arc, webSockets: true }). */
export function mountFastify(app: FastifyInstance, application: ArcServer | ArcApplication,
    native?: (request: FastifyRequest) => NativeRequestContext | Promise<NativeRequestContext>, prefix = ''): void {
    const server = 'server' in application ? application.server : application;
    // Encapsulated parsers never replace the parent application's content-type behavior.
    const webSockets = fastifyWebSocketMount(app);
    app.register(async scoped => {
        scoped.removeAllContentTypeParsers();
        scoped.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, payload, done) => done(null, payload));
        async function dispatch(request: FastifyRequest, reply: FastifyReply, path: string) {
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
                const payload = request.body;
                const body = Buffer.isBuffer(payload) ? new Uint8Array(payload) : undefined;
                const raw = request.raw.url ?? expected;
                const url = new URL(raw, origin);
                if (url.origin !== origin || url.pathname !== expected) return reply.code(400).send();
                const incoming = new Request(new URL(`${path}${url.search}`, origin), {
                    method: request.method, headers: new Headers(request.headers as Record<string, string>),
                    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
                    signal: controller.signal
                });
                const result = await server.handle(incoming, async () => {
                    const verified = await native?.(request);
                    return { ...verified, remoteAddress: verified?.remoteAddress ?? request.raw.socket.remoteAddress,
                        secure: verified?.secure ?? (request.raw.socket instanceof TLSSocket && request.raw.socket.encrypted === true) };
                });
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
            const operation = server.routes.get(path);
            const upgrades = path === '/.cratis/queries/ws' || operation && 'observable' in operation && operation.observable === true;
            const handler = (request: FastifyRequest, reply: FastifyReply) => dispatch(request, reply, path);
            if (webSockets && upgrades) {
                scoped.route({ method: 'GET', url: path, handler,
                    preValidation: (request, reply) => webSockets.preValidation(request, reply, path),
                    wsHandler: (socket, request) => webSockets.handle(socket, request) });
                scoped.route({ method: ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS',
                    ...(operation ? ['QUERY' as const] : [])], url: path, handler });
            } else {
                scoped.route({ method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD',
                    ...(operation ? ['QUERY' as const] : [])], url: path, handler,
                    ...(webSockets ? { preValidation: async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
                        if (request.headers.upgrade?.toLowerCase() === 'websocket') await reply.code(426).send();
                    } } : {}) });
            }
        }
    });
}
