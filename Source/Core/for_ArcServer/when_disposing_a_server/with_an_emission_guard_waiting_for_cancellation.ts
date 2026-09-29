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
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when an in-flight emission guard waits for cancellation during shutdown', () => {
    let canceled: boolean;
    beforeEach(async () => {
        canceled = false;
        const entered = gate();
        const token = serviceToken<ObservableEmissionGuard>('cooperative policy');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: (): ObservableEmissionGuard => ({ check: async emission => {
                entered.release();
                if (!emission.signal.aborted) await new Promise<void>(resolve => {
                    emission.signal.addEventListener('abort', () => resolve(), { once: true });
                });
                canceled = true;
                return ObservableEmissionDecision.Suppress;
            } }) }], query: { observableEmissionGuards: [token] },
        observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
            observe: () => CurrentValueSubject.of(1) })] });
        const session = await server.openObservableQuery('Live', {}, observableExecution());
        const stream = session.results();
        const next = stream.next();
        await beforeDeadline(entered.promise, 'emission guard entry');
        server.services.addShutdownParticipant({ stop: () => {}, drain: async () => {} });
        const closing = server.dispose();
        try {
            await beforeDeadline(closing, 'cooperative emission shutdown');
            await beforeDeadline(next, 'cooperative emission cancellation');
        } finally { await beforeDeadline(server.dispose(), 'cooperative emission cleanup'); }
    });
    it('should abort the guard before draining tracked executions', () => canceled.should.equal(true));
});
