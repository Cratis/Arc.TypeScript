// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_chronicle_query, BalanceChanged } from '../given/a_chronicle_query.js';

describe('when performing a Chronicle query for an unseeded source', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create<null>>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = context.create<null>('byId');
        scenario.given.forEventSource('another-source').events(new BalanceChanged(5));
        result = await scenario.perform({ id: 'missing' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should return missing rather than another source model', () => {
        result.isSuccess.should.equal(true);
        (result.data == null).should.equal(true);
    });
}));
