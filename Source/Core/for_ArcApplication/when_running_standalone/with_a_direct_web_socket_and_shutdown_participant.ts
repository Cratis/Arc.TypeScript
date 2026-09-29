// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { beforeDeadline, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { openDirectWebSocket } from '../../for_ArcServer/given/a_direct_web_socket.js';

should();
describe('when stopping a standalone application with a live direct WebSocket and participant', () => {
    let events: string[];
    beforeEach(async () => {
        events = [];
        const canceled = gate();
        const token = serviceToken<object>('application WebSocket scope');
        const server = new ArcServer({ query: { observableShutdownTimeoutMs: 250 },
            services: [{ token, lifetime: ServiceLifetime.Scoped,
                factory: () => ({ [Symbol.asyncDispose]: async () => {
                    await canceled.promise; events.push('scope disposed');
                } }) }],
            observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}), handlerDependencies: [token],
                observe: async () => { await currentServices().resolve(token); return CurrentValueSubject.of(1); } })] });
        const application = new ArcApplication(server);
        const probe = createServer();
        await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
        const port = (probe.address() as AddressInfo).port;
        await new Promise<void>(resolve => probe.close(() => resolve()));
        await application.start({ port });
        const socket = await openDirectWebSocket(port);
        try {
            server.services.addShutdownParticipant({ stop: () => { events.push('stop'); canceled.release(); },
                drain: async () => { events.push('drain'); } });
            await beforeDeadline(application.stop(), 'application direct WebSocket shutdown');
        } finally { canceled.release(); socket.terminate(); await application.stop().catch(() => {}); }
    });
    it('should stop and drain before disposing the live WebSocket scope', () => {
        events.should.deep.equal(['stop', 'drain', 'scope disposed']);
    });
});
