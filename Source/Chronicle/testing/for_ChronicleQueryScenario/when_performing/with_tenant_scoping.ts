// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_chronicle_query, BalanceChanged } from '../given/a_chronicle_query.js';

describe('when performing a Chronicle query in a selected tenant', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create<{ amount: number }>>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = context.create<{ amount: number }>('byId');
        const selected = scenario.given.forEventSource('same-id');
        scenario.given.forEventSource('same-id', 'tenant-a').events(new BalanceChanged(7));
        scenario.withContext({ tenantId: 'tenant-b' });
        selected.events(new BalanceChanged(2));
        result = await scenario.perform({ id: 'same-id' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should resolve the default seed tenant at seed time', () => { result.data!.amount.should.equal(2); });
}));

describe('when performing a Chronicle query without seeded state in the selected tenant', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create<null>>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = context.create<null>('byId');
        scenario.given.forEventSource('same-id', 'tenant-a').events(new BalanceChanged(7));
        scenario.withContext({ tenantId: 'tenant-b' });
        result = await scenario.perform({ id: 'same-id' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should return missing rather than leaking another tenant', () => {
        result.isSuccess.should.equal(true);
        (result.data == null).should.equal(true);
    });
}));
