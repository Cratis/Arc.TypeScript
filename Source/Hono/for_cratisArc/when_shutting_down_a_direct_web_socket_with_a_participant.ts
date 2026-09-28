// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createServer, type Server } from 'node:http';
import type { Socket } from 'node:net';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import WebSocket from 'ws';
import { z } from 'zod';
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.core';
import { shutdownArcHost } from '@cratis/arc.core/hosting';
import { cratisArc } from '../index.js';

should();
describe('when Hono shuts down a direct query WebSocket with a shutdown participant', () => {
    let openAtStop: number | undefined;
    beforeEach(async () => {
        openAtStop = undefined;
        const arc = new ArcServer({ observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
            observe: () => CurrentValueSubject.of(1) })] });
        const app = new Hono();
        const middleware = cratisArc(arc);
        app.use(middleware);
        const listener = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0, createServer }) as Server;
        await new Promise<void>((resolve, reject) => { listener.once('listening', resolve); listener.once('error', reject); });
        const connections = new Set<Socket>();
        listener.on('connection', connection => { connections.add(connection); });
        const disposeSockets = middleware.injectWebSocket(listener);
        const close = async (): Promise<void> => {
            await disposeSockets();
            const closed = new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
            listener.closeAllConnections();
            await closed;
        };
        const address = listener.address();
        if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
        const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/live`);
        socket.on('error', () => {});
        try {
            await new Promise<void>((resolve, reject) => { socket.once('message', () => resolve()); socket.once('error', reject); });
            arc.services.addShutdownParticipant({ stop: () => {
                openAtStop = [...connections].filter(connection => !connection.destroyed).length;
            }, drain: async () => {} });
            await shutdownArcHost(arc, close);
        } finally {
            socket.terminate();
            if (listener.listening) await close().catch(() => {});
            await arc.dispose().catch(() => {});
        }
    });
    it('should close the upgraded connection before participant stop', () => should().equal(openAtStop, 0));
});
