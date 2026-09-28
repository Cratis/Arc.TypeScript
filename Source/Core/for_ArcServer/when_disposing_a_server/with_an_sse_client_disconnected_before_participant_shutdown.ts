// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { beforeDeadline, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();
const path = 'http://localhost/.cratis/queries/sse';

describe('when an SSE client disconnects immediately before participant shutdown', () => {
    let events: string[];
    beforeEach(async () => {
        events = [];
        const entered = gate(); const canceled = gate();
        const token = serviceToken<object>('SSE scope');
        const server = new ArcServer({ query: { observableShutdownTimeoutMs: 250 },
            services: [{ token, lifetime: ServiceLifetime.Scoped,
                factory: () => ({ [Symbol.asyncDispose]: async () => {
                    events.push('disposer started'); entered.release();
                    await canceled.promise; events.push('scope disposed');
                } }) }],
            observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}), handlerDependencies: [token],
                observe: async () => { await currentServices().resolve(token); return new CurrentValueSubject(1); } })] });
        const response = (await server.handle(new Request(path)))!;
        const reader = response.body!.getReader();
        const connected = new TextDecoder().decode((await reader.read()).value);
        const connectionId = JSON.parse(connected.slice(6)).payload as string;
        const draining = (async () => { while (!(await reader.read()).done) { /* Keep deliveries flowing. */ } })();
        try {
            const subscription = await server.handle(new Request(`${path}/subscribe`, { method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ connectionId, queryId: 'q', request: { queryName: 'Live' } }) }));
            subscription?.status.should.equal(200);
            server.services.addShutdownParticipant({ stop: () => { events.push('stop'); canceled.release(); },
                drain: async () => { events.push('drain'); } });
            await reader.cancel();
            await beforeDeadline(entered.promise, 'disconnected SSE disposer entry');
            await beforeDeadline(server.dispose(), 'disconnected SSE shutdown');
            await draining;
        } finally { canceled.release(); await reader.cancel(); await server.dispose(); }
    });
    it('should stop before the pending disposer completes and drain without timing out', () => {
        events.should.have.lengthOf(4);
        events[0]!.should.equal('disposer started');
        events.indexOf('stop').should.be.lessThan(events.indexOf('scope disposed'));
        events.indexOf('stop').should.be.lessThan(events.indexOf('drain'));
    });
});
