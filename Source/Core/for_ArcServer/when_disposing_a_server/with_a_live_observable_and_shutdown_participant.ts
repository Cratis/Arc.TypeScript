// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { beforeDeadline, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when disposing a server with a live observable and shutdown participant', () => {
    let beforeRelease: string[];
    let events: string[];
    beforeEach(async () => {
        events = [];
        const token = serviceToken<object>('subscription dependency');
        const entered = gate(); const release = gate();
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ [Symbol.dispose]: () => { events.push('scope disposed'); } }) }],
        observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}), handlerDependencies: [token],
            observe: async () => { await currentServices().resolve(token); return new CurrentValueSubject(1); } })] });
        await server.openObservableQuery('Live', {}, observableExecution());
        server.services.addShutdownParticipant({ stop: () => { events.push('stop'); },
            drain: async () => { entered.release(); await release.promise; events.push('drained'); } });
        try {
            const closing = server.dispose();
            await beforeDeadline(entered.promise, 'observable participant drain');
            beforeRelease = [...events];
            release.release();
            await beforeDeadline(closing, 'observable shutdown');
        } finally { release.release(); await server.dispose(); }
    });
    it('should retain the observable scope until every participant has drained', () => {
        beforeRelease.should.deep.equal(['stop']);
        events.should.deep.equal(['stop', 'drained', 'scope disposed']);
    });
});
