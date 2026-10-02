// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { beforeDeadline, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when an observable emits during participant drain', () => {
    let logged: unknown[];
    let results: unknown[];
    beforeEach(async () => {
        logged = []; results = [];
        const subject = CurrentValueSubject.of(1);
        const server = new ArcServer({ environmentName: 'Development', logger: error => { logged.push(error); },
            observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}), observe: () => subject })] });
        const session = await server.openObservableQuery('Live', {}, observableExecution());
        const stream = session.results();
        await stream.next();
        const entered = gate(); const release = gate();
        server.services.addShutdownParticipant({ stop: () => {}, drain: async () => {
            entered.release(); await release.promise;
        } });
        try {
            const closing = server.dispose();
            await beforeDeadline(entered.promise, 'observable drain entry');
            const next = stream.next();
            subject.next(2);
            release.release();
            const outcome = await beforeDeadline(next, 'observable drain stream');
            if (outcome.value) results.push(outcome.value);
            await beforeDeadline(closing, 'observable drain shutdown');
        } finally { release.release(); await beforeDeadline(server.dispose(), 'observable drain cleanup'); }
    });
    it('should end quietly instead of publishing a disposal error to clients', () => {
        results.length.should.equal(0);
        logged.length.should.equal(0);
    });
});
