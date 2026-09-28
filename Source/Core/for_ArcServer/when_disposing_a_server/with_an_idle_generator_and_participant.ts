// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when a generator awaits an event that never arrives during participant shutdown', () => {
    let events: string[];
    let failure: unknown;
    let settled: boolean;
    beforeEach(async () => {
        events = [];
        async function* source(): AsyncGenerator<number> {
            yield 1;
            await new Promise<never>(() => {});
        }
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Idle', schema: z.object({}), observe: () => source()
        })] });
        const session = await server.openObservableQuery('Idle', {}, observableExecution());
        const iterator = session.results();
        await iterator.next();
        void iterator.next().catch(() => {});
        server.services.addShutdownParticipant({
            stop: () => { events.push('stop'); },
            drain: async () => { events.push('drain'); }
        });
        let timer: ReturnType<typeof setTimeout> | undefined;
        const deadline = new Promise<'hung'>(resolve => { timer = setTimeout(() => resolve('hung'), 3000); });
        const outcome = await Promise.race([captureFailure(server.dispose()).then(error => ({ error })), deadline]);
        clearTimeout(timer);
        settled = outcome !== 'hung';
        failure = outcome === 'hung' ? undefined : outcome.error;
    });
    it('should settle shutdown', () => settled.should.equal(true));
    it('should stop and drain the participant', () => events.should.deep.equal(['stop', 'drain']));
    it('should report the source that did not respond to cancellation', () => {
        const leaves = (error: unknown): unknown[] => error instanceof AggregateError ? error.errors.flatMap(leaves) : [error];
        leaves(failure).map(error => (error as Error).message).should.include('Observable source did not respond to cancellation');
    });
});
