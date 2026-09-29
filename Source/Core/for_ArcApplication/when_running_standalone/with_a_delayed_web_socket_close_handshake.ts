// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { connect, createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ArcApplication } from '../../ArcApplication.js';
import { beforeDeadline } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when listener and registry close during a delayed real WebSocket handshake', () => {
    let events: string[];
    let failures: unknown[];
    beforeEach(async () => {
        events = [];
        const server = new ArcServer({ query: { observableShutdownTimeoutMs: 60 } });
        const application = new ArcApplication(server);
        const probe = createServer();
        await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
        const port = (probe.address() as AddressInfo).port;
        await new Promise<void>(resolve => probe.close(() => resolve()));
        await application.start({ port });
        const socket = connect(port, '127.0.0.1');
        socket.on('error', () => {});
        let socketClosed = false;
        socket.once('close', () => { socketClosed = true; events.push('socket closed'); });
        try {
            await beforeDeadline(new Promise<void>(resolve => socket.once('connect', resolve)), 'raw socket connect');
            const handshake = new Promise<void>(resolve => socket.on('data', chunk => {
                if (chunk.toString().includes('101 Switching Protocols')) resolve();
            }));
            socket.write('GET /.cratis/queries/ws HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\n' +
                'Connection: Upgrade\r\nSec-WebSocket-Version: 13\r\n' +
                'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n');
            await beforeDeadline(handshake, 'WebSocket handshake');
            server.services.addShutdownParticipant({ stop: () => { events.push(`stop:${socketClosed}`); },
                drain: async () => { events.push('drain'); } });
            const registryClosing = server.dispose();
            const listenerClosing = application.stop();
            const outcomes = await beforeDeadline(Promise.allSettled([registryClosing, listenerClosing]),
                'concurrent WebSocket shutdown');
            failures = outcomes.map(outcome => outcome.status === 'rejected' ? outcome.reason : undefined);
        } finally { socket.destroy(); await application.stop().catch(() => {}); }
    });
    it('should join the same transport failure before running participant stop', () => {
        events.should.deep.equal(['socket closed', 'stop:true', 'drain']);
        for (const failure of failures) {
            should().equal(failure === undefined, false);
            const leaves = (error: unknown): unknown[] => error instanceof AggregateError
                ? error.errors.flatMap(leaves) : [error];
            leaves(failure).some(error => error instanceof Error && error.message === 'Arc WebSocket shutdown timed out')
                .should.equal(true);
        }
    });
});
