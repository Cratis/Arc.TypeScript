// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { beforeDeadline, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { ObservableEmissionDecision } from '../../queries/observable/ObservableEmissionDecision.js';
import type { ObservableEmissionGuard } from '../../queries/observable/ObservableEmissionGuard.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when source cleanup runs while its consumer guard awaits participant stop', () => {
    let events: string[];
    beforeEach(async () => {
        events = [];
        const entered = gate(); const stopped = gate(); const released = gate();
        async function* source(): AsyncGenerator<number> {
            try { yield 1; }
            finally { events.push('source released'); released.release(); }
        }
        const guard = serviceToken<ObservableEmissionGuard>('waiting guard');
        const server = new ArcServer({
            services: [{ token: guard, lifetime: ServiceLifetime.Scoped, factory: () => ({
                check: async () => { entered.release(); await stopped.promise; events.push('guard completed');
                    return ObservableEmissionDecision.Allow; }
            }) }], query: { observableEmissionGuards: [guard] },
            observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}), observe: () => source() })]
        });
        const session = await server.openObservableQuery('Live', {}, observableExecution());
        const reading = session.results().next();
        await beforeDeadline(entered.promise, 'waiting guard entry');
        server.services.addShutdownParticipant({ stop: () => { events.push('stop'); stopped.release(); },
            drain: async () => { await released.promise; events.push('drain'); } });
        try { await beforeDeadline(server.dispose(), 'guard and producer shutdown');
            await beforeDeadline(reading, 'canceled guard');
        } finally { stopped.release(); released.release(); }
    });
    it('should release the producer before stop without waiting for its consumer guard', () => {
        events.slice(0, 2).should.deep.equal(['source released', 'stop']);
        events.should.include('drain');
        events.should.include('guard completed');
        (events.indexOf('guard completed') > events.indexOf('stop')).should.equal(true);
    });
});
