// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import express from 'express';
import fastify from 'fastify';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { mountExpress, mountExpressWebSockets } from '@cratis/arc.server.express';
import { mountFastify, mountFastifyWebSockets } from '@cratis/arc.server.fastify';
import { mountHono, mountHonoWebSockets } from '@cratis/arc.server.hono';

/** Listen on loopback with real native HTTP and WS bridges on each adapter. */
export async function observableHost(kind, server) {
    if (kind === 'express') {
        const app = express(); mountExpress(app, server);
        const listener = app.listen(0, '127.0.0.1');
        await new Promise(resolve => listener.once('listening', resolve));
        mountExpressWebSockets(listener, server);
        return { origin: `http://127.0.0.1:${listener.address().port}`,
            close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())) };
    }
    if (kind === 'fastify') {
        const app = fastify(); mountFastify(app, server);
        await app.listen({ port: 0, host: '127.0.0.1' });
        mountFastifyWebSockets(app, server);
        return { origin: app.listeningOrigin, close: () => app.close() };
    }
    const app = new Hono(); mountHono(app, server);
    const listener = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
    await new Promise(resolve => listener.once('listening', resolve));
    mountHonoWebSockets(listener, server);
    return { origin: `http://127.0.0.1:${listener.address().port}`,
        close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())) };
}
