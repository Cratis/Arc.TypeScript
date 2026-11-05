// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_ticker } from '../given/a_ticker.js';

describe('when observing the ticker', given(a_ticker, context => {
    let result: Awaited<ReturnType<typeof context.observable.collect>>;
    beforeEach(async () => {
        context.ticks.next(0);
        context.ticks.next(1);
        result = await context.observable.collect(2, 1_000);
    });
    afterAll(async () => { await context.observable.dispose(); });
    it('should emit a tick for every clock tick', () => {
        result.emissions.should.have.lengthOf(2);
        result.emissions.map(emission => emission.data?.tick).should.deep.equal([1, 2]);
    });
    it('should stamp every tick with the time', () => {
        String(result.emissions[0]?.data?.time).should.match(/^\d{4}-\d{2}-\d{2}T/);
    });
}));
