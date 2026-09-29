// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { beforeDeadline, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { runArc } from '../../http/runArc.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { openDirectWebSocket } from '../given/a_direct_web_socket.js';

should();
describe('when a direct WebSocket disconnects immediately before participant shutdown', () => {
    let events: string[];
    beforeEach(async () => {
        events = [];
        const entered = gate();
        const canceled = gate();
        const token = serviceToken<object>('direct socket scope');
        const server = new ArcServer({ query: { observableShutdownTimeoutMs: 250 },
            services: [{ token, lifetime: ServiceLifetime.Scoped,
                factory: () => ({ [Symbol.asyncDispose]: async () => {
                    events.push('disposer started'); entered.release();
                    await canceled.promise; events.push('scope disposed');
                } }) }],
            observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}), handlerDependencies: [token],
                observe: async () => { await currentServices().resolve(token); return CurrentValueSubject.of(1); } })] });
        const listener = await runArc(server, { port: 0 });
        const socket = await openDirectWebSocket(listener.server);
        try {
            server.services.addShutdownParticipant({ stop: () => { events.push('stop'); canceled.release(); },
                drain: async () => { events.push('drain'); } });
            socket.terminate();
            await beforeDeadline(entered.promise, 'disconnected direct WebSocket disposer entry');
            await beforeDeadline(server.dispose(), 'disconnected direct WebSocket shutdown');
            await beforeDeadline(listener.close(), 'disconnected direct listener shutdown');
        } finally {
            canceled.release();
            socket.terminate();
            await server.dispose().catch(() => {});
            await listener.close().catch(() => {});
        }
    });
    it('should stop and drain before completing the already started scope disposal', () => {
        events.should.deep.equal(['disposer started', 'stop', 'scope disposed', 'drain']);
    });
});
