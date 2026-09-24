// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();

describe('when opening an observable query with a failed source', () => {
    let first: number | undefined;
    let failed: { exceptionMessages: string[]; isSuccess: boolean };
    let done: boolean | undefined;
    let logged: unknown[];

    beforeEach(async () => {
        const subject = CurrentValueSubject.of(1);
        logged = [];
        const server = new ArcServer({ logger: error => { logged.push(error); }, observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => subject
        })] });
        const session = await server.openObservableQuery('Numbers', {}, observableExecution());
        const stream = session.results();
        first = (await stream.next()).value?.data;
        subject.error(new Error('private source failure'));
        failed = (await stream.next()).value!;
        done = (await stream.next()).done;
        await server.dispose();
    });

    it('should deliver the value before failure', () => { first?.should.equal(1); });
    it('should redact the terminal exception', () => { failed.exceptionMessages.should.deep.equal(['An unexpected error occurred']); });
    it('should mark the terminal result as failed', () => { failed.isSuccess.should.equal(false); });
    it('should complete after the terminal result', () => { done?.should.equal(true); });
    it('should log the original failure', () => { (logged[0] as Error).message.should.equal('private source failure'); });
});
