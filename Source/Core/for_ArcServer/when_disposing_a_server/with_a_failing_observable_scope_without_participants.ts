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
describe('when an observable scope fails to dispose without participants', () => {
    let failure: AggregateError;
    let leaf: Error;
    beforeEach(async () => {
        leaf = new Error('scope disposer failed');
        const token = serviceToken<object>('scope');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ [Symbol.dispose]: () => { throw leaf; } }) }],
        observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}), handlerDependencies: [token],
            observe: async () => { await currentServices().resolve(token); return CurrentValueSubject.of(1); } })] });
        await server.openObservableQuery('Live', {}, observableExecution());
        failure = await beforeDeadline(captureFailure(server.dispose()), 'participant-free scope failure') as AggregateError;
    });
    it('should throw the original subscription error shape once', () => {
        failure.message.should.equal('Observable subscription cleanup failed');
        failure.errors.should.have.lengthOf(1);
        const scopeError = failure.errors[0] as AggregateError;
        scopeError.message.should.equal('Service disposal failed');
        scopeError.errors.should.deep.equal([leaf]);
    });
});
