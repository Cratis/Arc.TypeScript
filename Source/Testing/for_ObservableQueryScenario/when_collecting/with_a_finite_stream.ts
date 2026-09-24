// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { query, readModel } from '@cratis/arc.core';
import { ObservableQueryScenario } from '../../index.js';

@readModel()
class FiniteItem {
    @query({ observable: true })
    static async *observe(): AsyncGenerator<number> { yield 1; }
}

describe('when collecting from a finite observable stream', () => {
    let scenario: ObservableQueryScenario<number>;
    let completed: boolean;
    let count: number;
    beforeEach(async () => {
        scenario = ObservableQueryScenario.for<number>(FiniteItem, 'observe');
        const result = await scenario.collect(2, 100);
        completed = result.completed;
        count = result.emissions.length;
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should distinguish early completion from reaching the emission limit', () => {
        completed.should.equal(true);
        count.should.equal(1);
    });
});
