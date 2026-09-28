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
describe('when an observable disposer waits for participant cancellation', () => {
    let events: string[];
    beforeEach(async () => {
        events = [];
        const canceled = gate();
        const token = serviceToken<object>('observable scope');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ [Symbol.asyncDispose]: async () => { events.push('disposer started');
                await canceled.promise; events.push('scope disposed'); } }) }],
        observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}), handlerDependencies: [token],
            observe: async () => { await currentServices().resolve(token); return CurrentValueSubject.of(1); } })] });
        await server.openObservableQuery('Live', {}, observableExecution());
        server.services.addShutdownParticipant({ stop: () => { events.push('stop'); canceled.release(); },
            drain: async () => { events.push('drain'); } });
        try { await beforeDeadline(server.dispose(), 'scope cancellation shutdown'); }
        finally { canceled.release(); }
    });
    it('should stop and drain before disposing the observable scope', () => {
        events.should.deep.equal(['stop', 'drain', 'disposer started', 'scope disposed']);
    });
});
