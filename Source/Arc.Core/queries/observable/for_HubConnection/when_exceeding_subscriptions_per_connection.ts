// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { HubFrameType } from '../HubFrameType.js';
import { HubSubscriptionOutcome } from '../HubSubscriptionOutcome.js';
import { a_query_connection } from './given/a_query_connection.js';

should();

describe('when exceeding subscriptions per physical connection', () => {
    let context: a_query_connection;
    let admitted: HubSubscriptionOutcome[];
    let count: number;
    let denied: HubSubscriptionOutcome;

    beforeEach(async () => {
        context = new a_query_connection(new ArcServer({ maxObservableSubscriptions: 64, maxObservableSubscriptionsPerCaller: 64,
            maxObservableHubSubscriptionsPerConnection: 32,
            observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}),
                observe: () => new CurrentValueSubject<number[]>([1]) })] }),
        { id: 'alice', isAuthenticated: true, roles: [] });
        await context.connection.connect();
        admitted = await Promise.all(Array.from({ length: 32 }, (_, index) =>
            context.connection.subscribe(`q${index}`, 1, { queryName: 'Numbers' })));
        count = context.connection.subscriptionCount;
        denied = await context.connection.subscribe('q32', 1, { queryName: 'Numbers' });
    });

    afterEach(async () => { await context.close(); });

    it('should admit the first 32 subscriptions', () => {
        admitted.every(value => value === HubSubscriptionOutcome.Accepted).should.equal(true);
    });
    it('should count the first 32 subscriptions', () => { count.should.equal(32); });
    it('should limit the 33rd subscription', () => { denied.should.equal(HubSubscriptionOutcome.Limited); });
    it('should send an error for the denied query', () => {
        context.frames.some(frame => frame.type === HubFrameType.Error && frame.queryId === 'q32').should.equal(true);
    });
});
