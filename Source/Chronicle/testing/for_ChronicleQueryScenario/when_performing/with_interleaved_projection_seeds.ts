// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_chronicle_query, BalanceChanged } from '../given/a_chronicle_query.js';

describe('when performing a projected query with interleaved sources', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create<{ sequence: string }>>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = context.create<{ sequence: string }>('sequenced');
        scenario.given.forEventSource('source-a').events(new BalanceChanged(1));
        scenario.given.forEventSource('source-b').events(new BalanceChanged(2));
        scenario.given.forEventSource('source-a').events(new BalanceChanged(3));
        result = await scenario.perform({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should assign sequence numbers in chronological seed order', () => {
        result.isSuccess.should.equal(true);
        result.data!.sequence.should.equal('2');
    });
}));
