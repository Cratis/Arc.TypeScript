// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createServer, type Server } from 'node:http';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import WebSocket from 'ws';
import { z } from 'zod';
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.core';
import { cratisArc } from '../index.js';

should();
describe('when Hono receives a direct query WebSocket upgrade during participant drain', () => {
    let status: number | undefined;
    let logged: unknown[];
    beforeEach(async () => {
        status = undefined;
        logged = [];
        const arc = new ArcServer({ logger: error => { logged.push(error); },
            observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
                observe: () => CurrentValueSubject.of(1) })] });
        const app = new Hono();
        const middleware = cratisArc(arc);
        app.use(middleware);
        const listener = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0, createServer }) as Server;
        await new Promise<void>((resolve, reject) => { listener.once('listening', resolve); listener.once('error', reject); });
        const disposeSockets = middleware.injectWebSocket(listener);
        const address = listener.address();
        if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
        try {
            arc.services.addShutdownParticipant({ stop: async () => {
                const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/live`);
                socket.on('error', () => {});
                status = await new Promise<number>(resolve => {
                    socket.once('unexpected-response', (_, response) => resolve(response.statusCode ?? 0));
                    socket.once('open', () => resolve(101));
                });
                socket.terminate();
            }, drain: async () => {} });
            await arc.dispose();
        } finally {
            await disposeSockets().catch(() => {});
            const closed = new Promise<void>(resolve => listener.close(() => resolve()));
            listener.closeAllConnections();
            await closed;
            await arc.dispose().catch(() => {});
        }
    });
    it('should refuse the upgrade as unavailable', () => should().equal(status, 503));
    it('should not log an error', () => logged.should.be.empty);
});
