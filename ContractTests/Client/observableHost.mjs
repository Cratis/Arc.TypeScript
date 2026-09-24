// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import express from 'express';
import fastify from 'fastify';
import { Hono } from 'hono';
import { cratisArc as expressArc } from '@cratis/arc.express';
import { cratisArc as fastifyArc } from '@cratis/arc.fastify';
import { cratisArc as honoArc, serveCratisArc } from '@cratis/arc.hono';

/** Listen on loopback with real native HTTP and WS bridges on each adapter. */
export async function observableHost(kind, server, native) {
    if (kind === 'express') {
        const app = express(); const middleware = expressArc(server, native); app.use(middleware);
        const listener = app.listen(0, '127.0.0.1');
        await new Promise(resolve => listener.once('listening', resolve));
        middleware.attach(listener, native);
        return { origin: `http://127.0.0.1:${listener.address().port}`,
            close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())) };
    }
    if (kind === 'fastify') {
        const app = fastify();
        await app.register(fastifyArc, { arc: server, native, webSockets: true });
        await app.listen({ port: 0, host: '127.0.0.1' });
        return { origin: app.listeningOrigin, close: () => app.close() };
    }
    const app = new Hono();
    app.route('/', honoArc(server, native));
    const hosted = await serveCratisArc(app, server, { port: 0, hostname: '127.0.0.1', native });
    const listener = hosted.server;
    return { origin: `http://127.0.0.1:${listener.address().port}`,
        close: () => hosted.dispose() };
}
