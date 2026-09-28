// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Socket } from 'node:net';
import Fastify from 'fastify';
import WebSocket from 'ws';
import { z } from 'zod';
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.core';
import { shutdownArcHost } from '@cratis/arc.core/hosting';
import { cratisArc } from '../index.js';

should();
describe('when Fastify shuts down a direct query WebSocket with a shutdown participant', () => {
    let openAtStop: number | undefined;
    beforeEach(async () => {
        openAtStop = undefined;
        const arc = new ArcServer({ observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
            observe: () => CurrentValueSubject.of(1) })] });
        const app = Fastify();
        await app.register(cratisArc, { arc, webSockets: true });
        const connections = new Set<Socket>();
        app.server.on('connection', connection => { connections.add(connection); });
        await app.listen({ port: 0, host: '127.0.0.1' });
        const socket = new WebSocket(app.listeningOrigin.replace('http:', 'ws:') + '/api/live');
        socket.on('error', () => {});
        try {
            await new Promise<void>((resolve, reject) => { socket.once('message', () => resolve()); socket.once('error', reject); });
            arc.services.addShutdownParticipant({ stop: () => {
                openAtStop = [...connections].filter(connection => !connection.destroyed).length;
            }, drain: async () => {} });
            await shutdownArcHost(arc, () => app.close());
        } finally { socket.terminate(); await app.close().catch(() => {}); await arc.dispose().catch(() => {}); }
    });
    it('should close the upgraded connection before participant stop', () => should().equal(openAtStop, 0));
});
