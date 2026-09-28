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
import type { ObservableEmissionGuard } from '../../queries/observable/ObservableEmissionGuard.js';
import type { ObservableEmissionContext } from '../../queries/observable/ObservableEmissionContext.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when an already-running emission guard fails after shutdown cancellation', () => {
    let logged: unknown[];
    let returned: unknown;
    let failure: Error;
    beforeEach(async () => {
        logged = [];
        failure = new Error('unrelated policy failure');
        const entered = gate(); const release = gate(); const canceled = gate();
        const policy = serviceToken<ObservableEmissionGuard>('failing guard');
        const server = new ArcServer({ logger: error => { logged.push(error); },
            services: [{ token: policy, lifetime: ServiceLifetime.Scoped, factory: () => ({
                check: async (emission: ObservableEmissionContext) => { entered.release(); emission.signal.addEventListener('abort', canceled.release, { once: true });
                    await release.promise; throw failure; }
            }) }], query: { observableEmissionGuards: [policy] },
        observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
            observe: () => CurrentValueSubject.of(1) })] });
        const session = await server.openObservableQuery('Live', {}, observableExecution());
        const current = session.current();
        try {
            await beforeDeadline(entered.promise, 'guard entry');
            const closing = server.dispose();
            await beforeDeadline(canceled.promise, 'guard cancellation');
            release.release();
            returned = await beforeDeadline(current, 'guard settlement');
            await beforeDeadline(closing, 'guard shutdown');
        } finally { release.release(); }
    });
    it('should log the unrelated guard error while suppressing its emission', () => {
        logged.should.deep.equal([failure]);
        should().equal(returned, undefined);
    });
});
