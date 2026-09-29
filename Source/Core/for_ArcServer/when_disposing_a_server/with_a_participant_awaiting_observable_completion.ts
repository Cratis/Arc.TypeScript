// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when a participant drains an observable stream canceled by shutdown', () => {
    let streamDone: boolean;
    beforeEach(async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({ name: 'Live',
            schema: z.object({}), observe: () => CurrentValueSubject.of(1) })] });
        const session = await server.openObservableQuery('Live', {}, observableExecution());
        const stream = session.results();
        await stream.next();
        const next = stream.next();
        server.services.addShutdownParticipant({ stop: () => {}, drain: async () => {
            streamDone = (await next).done ?? false;
        } });
        await beforeDeadline(server.dispose(), 'observable completion participant drain');
    });
    it('should finish the stream before destroying its scope', () => streamDone.should.equal(true));
});
