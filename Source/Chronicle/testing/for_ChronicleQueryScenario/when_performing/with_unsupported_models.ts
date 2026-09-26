// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_chronicle_query, BalanceChanged } from '../given/a_chronicle_query.js';

describe('when performing a Chronicle query for seeded projection history', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = context.create('projected');
        scenario.given.forEventSource('source-a').events(new BalanceChanged(2));
        result = await scenario.perform({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should require a kernel rather than fabricate a projection', () => {
        result.isSuccess.should.equal(false);
        JSON.stringify(result).should.contain('ChronicleKernelScenario');
    });
}));

describe('when performing a Chronicle query that lists read models', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = context.create('all');
        result = await scenario.perform();
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should reject unbacked list reads with a kernel hint', () => {
        result.isSuccess.should.equal(false);
        JSON.stringify(result).should.contain('cannot list read models; use ChronicleKernelScenario');
    });
}));
