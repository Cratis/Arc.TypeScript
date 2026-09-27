// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { beforeDeadline, captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when disposing a server after registry shutdown starts', () => {
    let events: string[];
    beforeEach(async () => {
        events = [];
        const broken = serviceToken<object>('broken');
        const server = new ArcServer({ services: [{ token: broken, lifetime: ServiceLifetime.Singleton,
            factory: () => { throw new Error('construction failed'); } }],
        observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
            observe: () => new CurrentValueSubject(1) })] });
        const session = await server.openObservableQuery('Live', {}, observableExecution());
        const originalClose = session.close.bind(session);
        session.close = () => { events.push('session closed'); return originalClose(); };
        server.closeWebSockets = async () => { events.push('websockets closed'); };
        server.services.addShutdownParticipant({ stop: () => { events.push('stop'); },
            drain: async () => { events.push('drain'); } });
        try {
            await beforeDeadline(server.services.dispose(), 'direct registry shutdown');
            await beforeDeadline(server.dispose(), 'server teardown after direct shutdown');
            await server.dispose();
        } finally { await captureFailure(server.dispose()); }
    });
    it('should close sessions and websockets exactly once after direct registry disposal', () => {
        events.should.deep.equal(['websockets closed', 'session closed', 'stop', 'drain']);
    });
});
