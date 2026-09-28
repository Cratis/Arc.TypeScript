// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { beforeDeadline } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when an active observable stream settles during participant drain', () => {
    let events: string[];
    beforeEach(async () => {
        events = [];
        const token = serviceToken<object>('stream scope');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ [Symbol.dispose]: () => { events.push('scope disposed'); } }) }],
        observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}), handlerDependencies: [token],
            observe: async () => { await currentServices().resolve(token); return CurrentValueSubject.of(1); } })] });
        const session = await server.openObservableQuery('Live', {}, observableExecution());
        const stream = session.results();
        await stream.next();
        const next = stream.next();
        server.services.addShutdownParticipant({ stop: () => { events.push('stop'); }, drain: async () => {
            const result = await beforeDeadline(next, 'stream completion');
            should().equal(result.done, true);
            events.push('drain');
        } });
        await beforeDeadline(server.dispose(), 'stream scope shutdown');
    });
    it('should keep the stream scope until participant drain is complete', () => {
        events.should.deep.equal(['stop', 'drain', 'scope disposed']);
    });
});
