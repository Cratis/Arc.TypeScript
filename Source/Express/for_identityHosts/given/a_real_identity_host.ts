// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createServer as httpServer, request as httpRequest, type IncomingMessage, type Server } from 'node:http';
import { createServer as httpsServer, request as httpsRequest } from 'node:https';
import { TLSSocket } from 'node:tls';
import express from 'express';
import Fastify from 'fastify';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { ArcServer, type NativeRequestContext } from '@cratis/arc.core';
import { mountExpress } from '../../index.js';
import { mountFastify } from '../../../Fastify/index.js';
import { mountHono } from '../../../Hono/index.js';
import { cert, key } from '../../../Arc.Core/for_legacy/tls-fixture.js';

type HostName = 'Express' | 'Fastify' | 'Hono';
export const hosts: readonly HostName[] = ['Express', 'Fastify', 'Hono'];

export async function socket(port: number, secure: boolean, path: string, headers: Record<string, string> = {}): Promise<{
    status: number; headers: IncomingMessage['headers']; body: string
}> {
    return new Promise((resolve, reject) => {
        const request = (secure ? httpsRequest : httpRequest)({ host: '127.0.0.1', port, path, method: 'GET', rejectUnauthorized: false, headers }, response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers, body }));
        });
        request.on('error', reject);
        request.end();
    });
}

async function closed(server: Server): Promise<void> {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

export async function startHost(host: HostName, arc: ArcServer, options: {
    secure?: boolean; native?: () => unknown; decorated?: boolean
} = {}): Promise<{ port: number; close(): Promise<void> }> {
    const secure = options.secure ?? false;
    let server: Server;
    let close: () => Promise<void>;
    if (host === 'Express') {
        const app = express();
        if (options.decorated) app.use((_request, response, next) => { response.cookie('host-cache', 'present'); next(); });
        mountExpress(app, arc, options.native as Parameters<typeof mountExpress>[2]);
        if (options.decorated) app.get('/foreign', (_request, response) => response.end('other'));
        server = secure ? httpsServer({ cert, key }, app) : httpServer(app);
        close = () => closed(server);
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    } else if (host === 'Fastify') {
        const app = Fastify({ serverFactory: handler => secure ? httpsServer({ cert, key }, handler) : httpServer(handler) });
        if (options.decorated) app.addHook('onRequest', (_request, reply, done) => { reply.header('set-cookie', 'host-cache=present; Path=/'); done(); });
        mountFastify(app, arc, options.native as Parameters<typeof mountFastify>[2]);
        if (options.decorated) app.get('/foreign', async () => 'other');
        await app.listen({ host: '127.0.0.1', port: 0 });
        server = app.server as Server;
        close = () => app.close();
    } else {
        const app = new Hono<{ Bindings: { incoming: IncomingMessage } }>();
        if (options.decorated) app.use('*', async (context, next) => {
            context.header('set-cookie', 'host-cache=present; Path=/');
            context.header('cache-control', 'public, max-age=3600');
            context.header('x-correlation-id', 'forged');
            await next();
        });
        mountHono(app, arc, context => options.native ? options.native() as NativeRequestContext :
            { secure: context.env.incoming.socket instanceof TLSSocket && context.env.incoming.socket.encrypted });
        if (options.decorated) app.get('/foreign', context => context.text('other'));
        server = secure
            ? serve({ fetch: app.fetch, createServer: httpsServer, serverOptions: { cert, key }, port: 0, hostname: '127.0.0.1' }) as Server
            : serve({ fetch: app.fetch, createServer: httpServer, port: 0, hostname: '127.0.0.1' }) as Server;
        close = () => closed(server);
        if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
    }
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('Missing address');
    return { port: address.port, close: async () => { await close(); await arc.dispose(); } };
}
