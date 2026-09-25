// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { createDispatcher } from './dispatch.js';
import { fastifyWebSocketMount, registerFastifyWebSockets } from './WebSocketMount.js';
import type { ArcApplication, ArcServer, NativeRequestContext } from '@cratis/arc.core';
import { serverOf } from '@cratis/arc.core/hosting';

export interface CratisArcOptions {
    arc: ArcServer | ArcApplication;
    prefix?: string;
    webSockets?: boolean;
    native?: (request: FastifyRequest) => NativeRequestContext | Promise<NativeRequestContext>;
}
/** One encapsulated Fastify registration for Arc HTTP and observable upgrades. */
export const cratisArc: FastifyPluginAsync<CratisArcOptions> = async (app, options) => {
    const server = serverOf(options.arc);
    const prefix = app.prefix || options.prefix || '';
    if (options.webSockets !== false) registerFastifyWebSockets(app, server, options.native, prefix);
    registerFastifyRoutes(app, options.arc, options.native, prefix);
};
export default cratisArc;

/** Register the Arc routes inside the plugin's Fastify scope. */
function registerFastifyRoutes(app: FastifyInstance, application: ArcServer | ArcApplication,
    native?: (request: FastifyRequest) => NativeRequestContext | Promise<NativeRequestContext>, prefix = ''): void {
    const server = serverOf(application);
    // Encapsulated parsers never replace the parent application's content-type behavior.
    const webSockets = fastifyWebSocketMount(app);
    const streams = new Set<{ abort(): void }>();
    app.addHook('preClose', () => {
        for (const stream of streams) stream.abort();
    });
    app.register(async scoped => {
        scoped.removeAllContentTypeParsers();
        scoped.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, payload, done) => done(null, payload));
        const dispatch = createDispatcher(server, prefix, native, streams);
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
