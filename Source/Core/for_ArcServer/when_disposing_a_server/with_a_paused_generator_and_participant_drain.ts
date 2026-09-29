// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when a generator is paused at a delivered value during participant shutdown', () => {
    let events: string[];
    beforeEach(async () => {
        events = [];
        const released = gate();
        async function* source(): AsyncGenerator<number> {
            try { yield 1; }
            finally { events.push('source released'); released.release(); }
        }
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Live', schema: z.object({}), observe: () => source()
        })] });
        const session = await server.openObservableQuery('Live', {}, observableExecution());
        const iterator = session.results();
        should().equal((await beforeDeadline(iterator.next(), 'first emission')).value?.data, 1);
        server.services.addShutdownParticipant({
            stop: () => { events.push('stop'); },
            drain: async () => { await released.promise; events.push('drain'); }
        });
        await beforeDeadline(server.dispose(), 'paused generator release');
    });
    it('should release the source before stopping and draining participants', () => {
        events.should.deep.equal(['source released', 'stop', 'drain']);
    });
});
