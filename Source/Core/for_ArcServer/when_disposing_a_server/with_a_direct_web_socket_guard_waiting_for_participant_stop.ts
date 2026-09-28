// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { beforeDeadline, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { runArc } from '../../http/runArc.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { ObservableEmissionDecision } from '../../queries/observable/ObservableEmissionDecision.js';
import type { ObservableEmissionGuard } from '../../queries/observable/ObservableEmissionGuard.js';

should();
describe('when a direct WebSocket emission guard waits for participant stop during shutdown', () => {
    let events: string[];
    beforeEach(async () => {
        events = [];
        const entered = gate();
        const canceled = gate();
        const token = serviceToken<ObservableEmissionGuard>('WebSocket guard');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
                factory: (): ObservableEmissionGuard => ({ check: async () => {
                    entered.release();
                    await canceled.promise;
                    return ObservableEmissionDecision.Suppress;
                } }) }], query: { observableEmissionGuards: [token], observableShutdownTimeoutMs: 250 },
            observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
                observe: () => CurrentValueSubject.of(1) })] });
        const listener = await runArc(server, { port: 0 });
        const port = (listener.server.address() as AddressInfo).port;
        const socket = new WebSocket(`ws://127.0.0.1:${port}/api/live`);
        socket.on('error', () => {});
        try {
            await beforeDeadline(entered.promise, 'direct guard entry');
            server.services.addShutdownParticipant({ stop: () => { events.push('stop'); canceled.release(); },
                drain: async () => { events.push('drain'); } });
            await beforeDeadline(server.dispose(), 'direct WebSocket guard shutdown');
            await beforeDeadline(listener.close(), 'direct WebSocket listener shutdown');
        } finally {
            canceled.release();
            socket.terminate();
            await server.dispose().catch(() => {});
            await listener.close().catch(() => {});
        }
    });
    it('should stop and drain without a WebSocket shutdown timeout', () => {
        events.should.deep.equal(['stop', 'drain']);
    });
});
