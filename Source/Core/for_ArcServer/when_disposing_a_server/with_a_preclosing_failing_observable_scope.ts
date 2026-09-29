// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { beforeDeadline, captureFailure, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when observable scope closure starts before participant shutdown and fails afterward', () => {
    let failure: AggregateError;
    let leaf: Error;
    let calls: number;
    beforeEach(async () => {
        calls = 0;
        leaf = new Error('scope failed');
        const entered = gate(); const release = gate(); const drained = gate();
        const token = serviceToken<object>('scope');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ [Symbol.asyncDispose]: async () => {
                calls++; entered.release(); await release.promise; throw leaf;
            } }) }], observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
                handlerDependencies: [token], observe: async () => {
                    await currentServices().resolve(token); return CurrentValueSubject.of(1);
                } })] });
        const session = await server.openObservableQuery('Live', {}, observableExecution());
        const closingSession = captureFailure(session.close());
        try {
            await beforeDeadline(entered.promise, 'scope disposer entry');
            server.services.addShutdownParticipant({ stop: () => {}, drain: async () => { drained.release(); } });
            const closing = captureFailure(server.dispose());
            await beforeDeadline(drained.promise, 'participant drain');
            release.release();
            failure = await beforeDeadline(closing, 'scope disposal failure') as AggregateError;
            await closingSession;
        } finally { release.release(); }
    });
    it('should report the one disposer failure only once', () => {
        calls.should.equal(1);
        const leaves = (error: unknown): unknown[] => error instanceof AggregateError && error.errors.length
            ? error.errors.flatMap(leaves) : [error];
        leaves(failure).should.deep.equal([leaf]);
    });
});
