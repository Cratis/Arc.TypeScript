// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { ServiceLifetime } from '../../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../../dependencyInjection/ServiceToken.js';
import { currentServices } from '../../../dependencyInjection/ServiceScope.js';
import { beforeDeadline, captureFailure } from '../../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { observableExecution } from '../../../for_ArcServer/given/an_observable_execution.js';

should();
describe('when closing a streaming session whose scope fails to dispose', () => {
    let failure: AggregateError;
    let leaf: Error;
    beforeEach(async () => {
        leaf = new Error('scope failed');
        const token = serviceToken<object>('failing dependency');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ [Symbol.dispose]: () => { throw leaf; } }) }],
        observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}), handlerDependencies: [token],
            observe: async () => { await currentServices().resolve(token); return CurrentValueSubject.of(1); } })] });
        const session = await server.openObservableQuery('Live', {}, observableExecution());
        await session.results().next();
        failure = await beforeDeadline(captureFailure(session.close()), 'session close') as AggregateError;
        await captureFailure(server.dispose());
    });
    // Without shutdown participants, close keeps its original shape: the iterator and the scope report the same failure.
    it('should report the cached scope failure from the iterator and the scope', () => {
        failure.message.should.equal('Observable subscription cleanup failed');
        failure.errors.should.have.lengthOf(2);
        failure.errors[0].should.equal(failure.errors[1]);
        const scope = failure.errors[0] as AggregateError;
        scope.message.should.equal('Service disposal failed');
        scope.errors.should.deep.equal([leaf]);
    });
});
