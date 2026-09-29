// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { beforeDeadline, captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when an observable scope disposer fails during participant shutdown', () => {
    let failure: AggregateError;
    let leaf: Error;
    let calls: number;
    beforeEach(async () => {
        calls = 0;
        leaf = new Error('scoped disposer failed');
        const token = serviceToken<object>('failing scope');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ [Symbol.dispose]: () => { calls++; throw leaf; } }) }],
        observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}), handlerDependencies: [token],
            observe: async () => { await currentServices().resolve(token); return CurrentValueSubject.of(1); } })] });
        await server.openObservableQuery('Live', {}, observableExecution());
        server.services.addShutdownParticipant({ stop: () => {}, drain: async () => {} });
        failure = await beforeDeadline(captureFailure(server.dispose()), 'failing observable scope') as AggregateError;
    });
    it('should report the scoped failure only once through the subscription cleanup', () => {
        failure.message.should.equal('Service registry disposal failed');
        failure.errors.should.have.lengthOf(1);
        const sessionError = failure.errors[0] as AggregateError;
        sessionError.message.should.equal('Observable subscription cleanup failed');
        sessionError.errors.should.have.lengthOf(1);
        const scopeError = sessionError.errors[0] as AggregateError;
        scopeError.message.should.equal('Service disposal failed');
        scopeError.errors.should.deep.equal([leaf]);
        calls.should.equal(1);
    });
});
