// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { beforeDeadline, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { ObservableEmissionDecision } from '../../queries/observable/ObservableEmissionDecision.js';
import type { ObservableEmissionGuard } from '../../queries/observable/ObservableEmissionGuard.js';

should();
describe('when a direct SSE guard awaits participant stop', () => {
    let events: string[];
    beforeEach(async () => {
        events = [];
        const entered = gate(); const stopped = gate();
        const guard = serviceToken<ObservableEmissionGuard>('SSE guard');
        const server = new ArcServer({ services: [{ token: guard, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ check: async () => {
                entered.release(); await stopped.promise;
                events.push('guard completed');
                return ObservableEmissionDecision.Suppress;
            } }) }], query: { observableEmissionGuards: [guard] },
            observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
                observe: () => CurrentValueSubject.of(1) })] });
        const response = await server.handle(new Request('http://localhost/api/live', {
            headers: { accept: 'text/event-stream' }
        }));
        const reader = response!.body!.getReader();
        const reading = reader.read();
        let outputClosed = false;
        void reader.closed.then(() => { outputClosed = true; });
        await beforeDeadline(entered.promise, 'SSE guard entry');
        server.services.addShutdownParticipant({ stop: () => { events.push(`stop:${outputClosed}`); stopped.release(); },
            drain: async () => { events.push('drain'); } });
        try {
            await beforeDeadline(server.dispose(), 'SSE guard shutdown');
            (await beforeDeadline(reading, 'SSE output completion')).done.should.equal(true);
        } finally { stopped.release(); await reader.cancel().catch(() => {}); }
    });
    it('should close SSE output before stop and join delivery before scope disposal', () => {
        events[0].should.equal('stop:true');
        events.should.include('drain');
        events.should.include('guard completed');
    });
});
