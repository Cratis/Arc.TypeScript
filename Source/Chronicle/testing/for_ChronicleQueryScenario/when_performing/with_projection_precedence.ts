// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_chronicle_query, BalanceChanged, ProjectedBalance, ProjectionPrecedenceReducer } from '../given/a_chronicle_query.js';

describe('when performing a projected query with a registered reducer', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create<{ amount: number }>>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = context.create<{ amount: number }>('projected', ProjectionPrecedenceReducer);
        scenario.given.forEventSource('source-a').events(new BalanceChanged(3));
        result = await scenario.perform({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should prefer the reducer over the projection', () => {
        result.isSuccess.should.equal(true);
        result.data!.amount.should.equal(6);
    });
}));

describe('when performing a projected query with a pinned instance', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create<{ amount: number }>>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = context.create<{ amount: number }>('projected');
        scenario.given.forEventSource('source-a').events(new BalanceChanged(3));
        scenario.given.forEventSource('source-a').readModel(Object.assign(new ProjectedBalance(), { amount: 11 }));
        result = await scenario.perform({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should prefer the pinned instance over projected history', () => {
        result.isSuccess.should.equal(true);
        result.data!.amount.should.equal(11);
    });
}));
