// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_chronicle_query, BalanceChanged, Balance, OtherBalance } from '../given/a_chronicle_query.js';

describe('when performing a Chronicle query with reducer history', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create<{ amount: number }>>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = context.create<{ amount: number }>('byId');
        scenario.given.forEventSource('source-a').events(new BalanceChanged(2), new BalanceChanged(3));
        scenario.given.forEventSource('source-b').events(new BalanceChanged(9));
        result = await scenario.perform({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should return only the selected reduced source', () => {
        result.isSuccess.should.equal(true);
        result.data!.amount.should.equal(5);
    });
}));

describe('when performing a Chronicle query with pinned history', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create<{ amount: number }>>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = context.create<{ amount: number }>('byId');
        scenario.given.forEventSource('source-a').events(new BalanceChanged(2));
        scenario.given.forEventSource('source-a').readModel(Object.assign(new Balance(), { amount: 8 }));
        result = await scenario.perform({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should prefer the pinned model over reducer history', () => { result.data!.amount.should.equal(8); });
}));

describe('when performing a Chronicle query with another pinned model type', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create<{ amount: number }>>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = context.create<{ amount: number }>('other');
        scenario.given.forEventSource('source-a').readModel(Object.assign(new OtherBalance(), { amount: 4 }));
        result = await scenario.perform({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should return the other pinned read model', () => { result.data!.amount.should.equal(4); });
}));
