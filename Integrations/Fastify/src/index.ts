// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ArcServer } from '@cratis/arc.server';

const origin = 'http://arc.invalid';
export function mountFastify(app: FastifyInstance, server: ArcServer): void {
    // Encapsulated parsers never replace the parent application's content-type behavior.
    app.register(async scoped => {
        scoped.removeAllContentTypeParsers();
        scoped.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, payload, done) => done(null, payload));
        async function dispatch(request: FastifyRequest, reply: FastifyReply, path: string) {
            const rawPath = request.raw.url?.split('?')[0];
            if (rawPath !== path) return reply.code(404).send();
            const controller = new AbortController();
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
                const result = await server.handle(incoming);
                if (!result) return reply.code(404).send();
                result.headers.forEach((value, key) => reply.header(key, value));
                return reply.code(result.status).send(await result.text());
            } finally {
                request.raw.off('aborted', abort);
                reply.raw.off('close', onClose);
            }
        }
        for (const path of server.routes.keys()) {
            scoped.route({ method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'QUERY'], url: path,
                handler: (request, reply) => dispatch(request, reply, path) });
        }
        for (const path of ['/.cratis/commands', '/.cratis/queries', '/.cratis/identity-details/schema', '/openapi.json']) {
            scoped.route({ method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'], url: path,
                handler: (request, reply) => dispatch(request, reply, path) });
        }
    });
}
