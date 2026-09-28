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
describe('when disposing a registry during a current-value emission guard', () => {
    let disposedDuringCheck: boolean;
    let disposedBeforeRelease: boolean;
    let disposed: boolean;
    beforeEach(async () => {
        disposed = false;
        const entered = gate(); const release = gate();
        const policy = serviceToken<ObservableEmissionGuard>('current policy');
        const server = new ArcServer({ services: [{ token: policy, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ check: async () => {
                entered.release(); await release.promise;
                disposedDuringCheck = disposed;
                return ObservableEmissionDecision.Allow;
            }, [Symbol.dispose]: () => { disposed = true; } }) }],
        query: { observableEmissionGuards: [policy] },
        observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
            observe: () => CurrentValueSubject.of(1) })] });
        const session = await server.openObservableQuery('Live', {}, observableExecution());
        const stopEntered = gate();
        const current = session.current();
        try {
            await beforeDeadline(entered.promise, 'current emission guard entry');
            server.services.addShutdownParticipant({ stop: () => { stopEntered.release(); }, drain: async () => {} });
            const closing = server.services.dispose();
            await beforeDeadline(stopEntered.promise, 'participant stop entry');
            await Promise.resolve();
            disposedBeforeRelease = disposed;
            release.release();
            await beforeDeadline(current, 'current emission guard completion');
            await beforeDeadline(closing, 'registry shutdown during current emission');
        } finally { release.release(); await session.close(); await server.dispose(); }
    });
    it('should keep the scoped dependency alive through the guard', () => {
        disposedBeforeRelease.should.equal(false);
        disposedDuringCheck.should.equal(false);
        disposed.should.equal(true);
    });
});
