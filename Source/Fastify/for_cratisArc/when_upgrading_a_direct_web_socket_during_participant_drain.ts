// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import Fastify from 'fastify';
import WebSocket from 'ws';
import { z } from 'zod';
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.core';
import { cratisArc } from '../index.js';

should();
describe('when Fastify receives a direct query WebSocket upgrade during participant drain', () => {
    let status: number | undefined;
    let logged: unknown[];
    beforeEach(async () => {
        status = undefined;
        logged = [];
        const arc = new ArcServer({ environmentName: 'Development', logger: error => { logged.push(error); },
            observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
                observe: () => CurrentValueSubject.of(1) })] });
        const app = Fastify();
        await app.register(cratisArc, { arc, webSockets: true });
        await app.listen({ port: 0, host: '127.0.0.1' });
        const url = app.listeningOrigin.replace('http:', 'ws:') + '/api/live';
        try {
            arc.services.addShutdownParticipant({ stop: async () => {
                const socket = new WebSocket(url);
                socket.on('error', () => {});
                status = await new Promise<number>(resolve => {
                    socket.once('unexpected-response', (_, response) => resolve(response.statusCode ?? 0));
                    socket.once('open', () => resolve(101));
                });
                socket.terminate();
            }, drain: async () => {} });
            await arc.dispose();
        } finally { await app.close().catch(() => {}); await arc.dispose().catch(() => {}); }
    });
    it('should refuse the upgrade as unavailable', () => should().equal(status, 503));
    it('should not log an error', () => logged.should.be.empty);
});
