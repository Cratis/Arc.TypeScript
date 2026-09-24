// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { authorize, CurrentValueSubject, query, readModel } from '@cratis/arc.core';
import { ObservableQueryScenario, type ObservableScenarioResult } from '../../index.js';

@readModel()
class RestrictedItem {
    @query({ observable: true })
    @authorize()
    static observe(): CurrentValueSubject<number> { return CurrentValueSubject.of(1); }
}

describe('when collecting an observable query rejected at opening', () => {
    let scenario: ObservableQueryScenario<number>;
    let result: ObservableScenarioResult<number>;
    beforeEach(async () => {
        scenario = ObservableQueryScenario.for<number>(RestrictedItem, 'observe');
        result = await scenario.collect(1, 100);
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should return the rejection rather than a successful emission', () => {
        result.rejection!.isAuthorized.should.equal(false);
        result.emissions.length.should.equal(0);
        result.completed.should.equal(false);
    });
});
