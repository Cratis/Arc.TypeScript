// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline, captureFailure, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when a participant drains a pending observable open', () => {
    let openingFailure: unknown;
    let drained: boolean;
    beforeEach(async () => {
        const entered = gate(); const release = gate();
        const server = new ArcServer({ observableQueries: [defineObservableQuery({ name: 'Pending',
            schema: z.object({}), observe: async () => {
                entered.release(); await release.promise; return CurrentValueSubject.of(1);
            } })] });
        const opening = captureFailure(server.openObservableQuery('Pending', {}, observableExecution()));
        try {
            await beforeDeadline(entered.promise, 'observable observe entry');
            server.services.addShutdownParticipant({ stop: () => { release.release(); }, drain: async () => {
                openingFailure = await beforeDeadline(opening, 'pending observable opening');
                drained = true;
            } });
            await beforeDeadline(server.dispose(), 'pending observable shutdown');
        } finally { release.release(); await opening; await server.dispose(); }
    });
    it('should reject the opening and let the participant drain settle', () => {
        (openingFailure as Error).message.should.equal('Arc server is disposed');
        drained.should.equal(true);
    });
});
