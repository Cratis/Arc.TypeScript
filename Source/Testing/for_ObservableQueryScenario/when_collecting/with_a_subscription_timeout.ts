// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { query, readModel, type ObservableSource } from '@cratis/arc.core';
import { ObservableQueryScenario } from '../../index.js';

@readModel()
class TrackedItem {
    static unsubscribed = 0;
    @query({ observable: true })
    static pending(): ObservableSource<number> {
        return { subscribe: () => ({ unsubscribe: () => { TrackedItem.unsubscribed++; } }) };
    }
}

describe('when an observable query times out waiting for an emission', () => {
    let scenario: ObservableQueryScenario<number>;
    let failure: unknown;
    beforeEach(async () => {
        TrackedItem.unsubscribed = 0;
        scenario = ObservableQueryScenario.for<number>(TrackedItem, 'pending');
        try { await scenario.collect(1, 30); } catch (error) { failure = error; }
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should close the subscription after reporting the timeout', () => {
        (failure as Error).message.should.contain('Timed out waiting');
        TrackedItem.unsubscribed.should.equal(1);
    });
});
