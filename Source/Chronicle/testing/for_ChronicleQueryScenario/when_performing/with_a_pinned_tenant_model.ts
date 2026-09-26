// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_chronicle_query, Balance } from '../given/a_chronicle_query.js';

describe('when performing a Chronicle query with a model pinned in a tenant', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create<{ amount: number }>>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = context.create<{ amount: number }>('byId');
        scenario.givenReadModel(Balance, 'source-a', Object.assign(new Balance(), { amount: 4 }), 'tenant-a');
        scenario.givenReadModel(Balance, 'source-a', Object.assign(new Balance(), { amount: 7 }), 'tenant-b');
        scenario.withContext({ tenantId: 'tenant-b' });
        result = await scenario.perform({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should return only the model in the selected tenant', () => { result.data!.amount.should.equal(7); });
}));
