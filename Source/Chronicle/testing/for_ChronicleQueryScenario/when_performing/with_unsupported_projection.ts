// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { UnsupportedProjectionOperation } from '@cratis/chronicle/testing';
import { a_chronicle_query, BalanceChanged } from '../given/a_chronicle_query.js';

describe('when performing a query with an unsupported projection', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create>;
    let failure: unknown;
    beforeEach(async () => {
        scenario = context.create('unsupported');
        scenario.given.forEventSource('source-a').events(new BalanceChanged(2));
        try { await scenario.perform({ id: 'source-a' }); } catch (error) { failure = error; }
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should propagate the SDK error type with its kernel guidance', () => {
        (failure instanceof UnsupportedProjectionOperation).should.equal(true);
        (failure as Error).message.should.contain('kernel-backed test');
    });
}));
