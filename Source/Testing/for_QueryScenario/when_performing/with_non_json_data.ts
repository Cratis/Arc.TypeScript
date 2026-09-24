// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { query, readModel } from '@cratis/arc.core';
import { QueryScenario } from '../../index.js';

@readModel()
class NonJsonItem {
    @query()
    static value(): { count: number } { return { count: Number.NaN }; }
}

describe('when performing a query with JSON round trips disabled', () => {
    let scenario: QueryScenario<{ count: number }>;
    let defaultScenario: QueryScenario<{ count: number | null }>;
    let count: number;
    let defaultCount: number | null;
    beforeEach(async () => {
        scenario = QueryScenario.for<{ count: number }>(NonJsonItem, 'value').withSerializationRoundTrip(false);
        defaultScenario = QueryScenario.for<{ count: number | null }>(NonJsonItem, 'value');
        count = (await scenario.perform()).data!.count;
        defaultCount = (await defaultScenario.perform()).data!.count;
    });
    afterEach(async () => { await scenario.dispose(); await defaultScenario.dispose(); });
    it('should preserve non-JSON values in the returned data', () => { Number.isNaN(count).should.equal(true); });
    it('should convert the same value to null by default', () => { (defaultCount === null).should.equal(true); });
});
