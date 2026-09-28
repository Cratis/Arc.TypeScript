// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import Fastify from 'fastify';
import WebSocket from 'ws';
import { z } from 'zod';
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, AuthenticationStatus, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.core';
import { cratisArc } from '../index.js';

should();
describe('when shutdown starts while a Fastify direct query WebSocket upgrade is authenticating', () => {
    let status: number | undefined;
    let logged: unknown[];
    let settled: boolean;
    beforeEach(async () => {
        status = undefined;
        logged = [];
        settled = false;
        let entered!: () => void;
        const authenticating = new Promise<void>(resolve => { entered = resolve; });
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const arc = new ArcServer({ logger: error => { logged.push(error); },
            authentication: [async () => { entered(); await gate; return { status: AuthenticationStatus.Anonymous }; }],
            observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
                observe: () => CurrentValueSubject.of(1) })] });
        const app = Fastify();
        await app.register(cratisArc, { arc, webSockets: true });
        await app.listen({ port: 0, host: '127.0.0.1' });
        const socket = new WebSocket(app.listeningOrigin.replace('http:', 'ws:') + '/api/live');
        socket.on('error', () => {});
        const outcome = new Promise<number>(resolve => {
            socket.once('unexpected-response', (_, response) => resolve(response.statusCode ?? 0));
            socket.once('open', () => resolve(101));
        });
        try {
            await authenticating;
            arc.services.addShutdownParticipant({ stop: async () => {
                release();
                status = await outcome;
            }, drain: async () => {} });
            await arc.dispose();
            settled = true;
        } finally { socket.terminate(); await app.close().catch(() => {}); await arc.dispose().catch(() => {}); }
    });
    it('should refuse the upgrade as unavailable', () => should().equal(status, 503));
    it('should not log an error', () => logged.should.be.empty);
    it('should settle the shutdown', () => settled.should.be.true);
});
