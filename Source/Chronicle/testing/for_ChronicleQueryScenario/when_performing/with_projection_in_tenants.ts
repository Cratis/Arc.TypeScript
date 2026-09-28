// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_chronicle_query, BalanceChanged } from '../given/a_chronicle_query.js';

describe('when performing a projected query in two tenants', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create<{ amount: number }>>;
    let first: Awaited<ReturnType<typeof scenario.perform>>;
    let second: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = context.create<{ amount: number }>('projected');
        scenario.given.forEventSource('same-id', 'tenant-a').events(new BalanceChanged(3));
        scenario.given.forEventSource('same-id', 'tenant-b').events(new BalanceChanged(8));
        scenario.withContext({ tenantId: 'tenant-a' });
        first = await scenario.perform({ id: 'same-id' });
        scenario.withContext({ tenantId: 'tenant-b' });
        second = await scenario.perform({ id: 'same-id' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should keep materialized projections isolated by tenant', () => {
        first.data!.amount.should.equal(3);
        second.data!.amount.should.equal(8);
    });
}));
