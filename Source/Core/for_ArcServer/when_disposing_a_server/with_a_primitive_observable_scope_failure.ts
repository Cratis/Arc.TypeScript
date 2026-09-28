// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when an observable scope disposer throws a primitive during shutdown', () => {
    let withoutParticipants: unknown;
    let withParticipants: unknown;
    const leaves = (error: unknown): unknown[] => error instanceof AggregateError && error.errors.length
        ? error.errors.flatMap(leaves) : [error];
    beforeEach(async () => {
        const dispose = async (hasParticipant: boolean): Promise<unknown> => {
            const token = serviceToken<object>('scope');
            const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
                factory: () => ({ [Symbol.dispose]: () => { throw 'scope failed'; } }) }],
            observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}), handlerDependencies: [token],
                observe: async () => { await currentServices().resolve(token); return new CurrentValueSubject(1); } })] });
            await server.openObservableQuery('Live', {}, observableExecution());
            if (hasParticipant) server.services.addShutdownParticipant({ stop: () => {}, drain: async () => {} });
            return captureFailure(server.dispose());
        };
        withoutParticipants = await dispose(false);
        withParticipants = await dispose(true);
    });
    it('should report the one scope failure without participants', () => {
        leaves(withoutParticipants).should.deep.equal(['scope failed']);
    });
    it('should report the one scope failure with participants', () => {
        leaves(withParticipants).should.deep.equal(['scope failed']);
    });
});
