// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();

describe('when opening an observable query with a global subscription limit', () => {
    let error: unknown;
    let reopened: boolean;

    beforeEach(async () => {
        const server = new ArcServer({ query: { maxObservableSubscriptions: 1 }, observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => new CurrentValueSubject<number>()
        })] });
        const first = await server.openObservableQuery('Numbers', {}, observableExecution());
        try { await server.openObservableQuery('Numbers', {}, observableExecution()); } catch (reason) { error = reason; }
        await first.close();
        const second = await server.openObservableQuery('Numbers', {}, observableExecution());
        reopened = Boolean(second);
        await second.close();
        await server.dispose();
    });

    it('should reject an overlapping subscription', () => {
        (error instanceof Error).should.equal(true);
        (error as Error).message.should.match(/subscription limit reached/);
    });
    it('should admit a new subscription after the first closes', () => { reopened.should.equal(true); });
});
