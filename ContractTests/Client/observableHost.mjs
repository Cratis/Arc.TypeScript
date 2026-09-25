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
        const disposeSockets = middleware.injectWebSocket(listener, native);
        return { origin: `http://127.0.0.1:${listener.address().port}`,
            close: async () => {
                await disposeSockets();
                const closed = new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
                listener.closeAllConnections();
                await closed;
            } };
    }
    if (kind === 'fastify') {
        const app = fastify();
        const foreignSockets = new Set();
        app.server.on('upgrade', (request, socket) => {
            if (server.endpoints.has(request.url?.split('?')[0] ?? '')) return;
            foreignSockets.add(socket);
            socket.once('close', () => foreignSockets.delete(socket));
        });
        await app.register(fastifyArc, { arc: server, native, webSockets: true });
        await app.listen({ port: 0, host: '127.0.0.1' });
        return { origin: app.listeningOrigin, close: async () => {
            // The test host owns foreign upgrades; Arc only drains Arc sockets.
            for (const socket of foreignSockets) socket.destroy();
            await app.close();
        } };
    }
    const app = new Hono();
    app.use(honoArc(server, native));
    const hosted = await serveCratisArc(app, server, { port: 0, hostname: '127.0.0.1', native });
    const listener = hosted.server;
    return { origin: `http://127.0.0.1:${listener.address().port}`,
        close: () => hosted.dispose() };
}
