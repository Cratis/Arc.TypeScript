// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceRegistry } from '../../dependencyInjection/ServiceRegistry.js';
import { beforeDeadline } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when a participant closes a live observable session during drain', () => {
    let closed: boolean;
    beforeEach(async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({ name: 'Live',
            schema: z.object({}), observe: () => CurrentValueSubject.of(1) })] });
        const session = await server.openObservableQuery('Live', {}, observableExecution());
        server.services.addShutdownParticipant({ stop: () => {}, drain: async () => {
            await beforeDeadline(session.close(), 'participant session close');
            closed = true;
        } });
        await beforeDeadline(server.dispose(), 'participant session shutdown');
    });
    it('should settle session close without joining the participant drain', () => closed.should.be.true);
});

describe('when a participant disposes a server with a host-owned registry', () => {
    let closed: boolean;
    beforeEach(async () => {
        const services = new ServiceRegistry();
        const server = new ArcServer({ services, observableQueries: [defineObservableQuery({ name: 'Live',
            schema: z.object({}), observe: () => CurrentValueSubject.of(1) })] });
        const session = await server.openObservableQuery('Live', {}, observableExecution());
        const originalClose = session.close.bind(session);
        session.close = () => { closed = true; return originalClose(); };
        services.addShutdownParticipant({ stop: () => {}, drain: async () => {
            await beforeDeadline(server.dispose(), 'host-owned server close');
        } });
        await beforeDeadline(services.dispose(), 'host-owned registry shutdown');
    });
    it('should settle server disposal without joining participant drain', () => closed.should.be.true);
});
