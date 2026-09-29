// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { AddressInfo } from 'node:net';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { beforeDeadline, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { openDirectWebSocket } from '../../for_ArcServer/given/a_direct_web_socket.js';
import { runArc } from '../runArc.js';

should();
describe('when the standalone host coordinates shutdown with a live observable', () => {
    let events: string[];
    beforeEach(async () => {
        events = [];
        const stopped = gate();
        const dependency = serviceToken<object>('host-scoped resource');
        const server = new ArcServer({ services: [{ token: dependency, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ [Symbol.asyncDispose]: async () => {
                await stopped.promise; events.push('scope disposed');
            } }) }], observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
            handlerDependencies: [dependency], observe: async () => {
                await currentServices().resolve(dependency); return CurrentValueSubject.of(1);
            } })] });
        const host = await runArc(server, { port: 0 });
        const socket = await openDirectWebSocket((host.server.address() as AddressInfo).port);
        try {
            server.services.addShutdownParticipant({ stop: () => { events.push('stop'); stopped.release(); },
                drain: async () => { events.push('drain'); } });
            await beforeDeadline(host.shutdown(), 'standalone coordinated host shutdown');
        } finally { stopped.release(); socket.terminate(); await host.close().catch(() => {}); }
    });
    it('should stop and drain before disposing the observable scope', () => {
        events.should.deep.equal(['stop', 'drain', 'scope disposed']);
    });
});
