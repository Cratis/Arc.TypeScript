// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ObservableQueryScenario } from '../../index.js';
import { PendingItem } from '../given/PendingItem.js';

describe('when collecting without an observable emission', () => {
    let scenario: ObservableQueryScenario<number>;
    let failure: unknown;
    beforeEach(async () => {
        scenario = ObservableQueryScenario.for<number>(PendingItem, 'pending');
        try { await scenario.collect(1, 20); }
        catch (error) { failure = error; }
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should fail on the explicit deadline', () => {
        (failure as Error).message.should.contain('Timed out waiting');
    });
});
