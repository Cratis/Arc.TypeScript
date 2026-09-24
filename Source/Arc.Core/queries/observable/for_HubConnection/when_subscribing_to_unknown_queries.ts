// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { HubSubscriptionOutcome } from '../HubSubscriptionOutcome.js';
import { a_query_connection } from './given/a_query_connection.js';

should();

describe('when subscribing to unknown queries before a valid query', () => {
    let context: a_query_connection;
    let missing: HubSubscriptionOutcome[];
    let afterMissing: number;
    let admitted: HubSubscriptionOutcome;

    beforeEach(async () => {
        context = new a_query_connection(new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => new CurrentValueSubject([1])
        })] }));
        missing = [];
        for (let index = 0; index < 40; index++)
            missing.push(await context.connection.subscribe(`missing${index}`, 1, { queryName: 'Missing' }));
        afterMissing = context.connection.subscriptionCount;
        admitted = await context.connection.subscribe('real', 1, { queryName: 'Numbers' });
    });

    afterEach(async () => { await context.close(); });

    it('should reject every unknown query', () => { missing.every(value => value === HubSubscriptionOutcome.Invalid).should.equal(true); });
    it('should release unknown query identifiers', () => { afterMissing.should.equal(0); });
    it('should admit the valid query', () => { admitted.should.equal(HubSubscriptionOutcome.Accepted); });
    it('should track the valid subscription', () => { context.connection.subscriptionCount.should.equal(1); });
});
