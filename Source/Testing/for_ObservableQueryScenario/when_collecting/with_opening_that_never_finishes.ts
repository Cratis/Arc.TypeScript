// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CurrentValueSubject, query, readModel, type ObservableSource } from '@cratis/arc.core';
import { ObservableQueryScenario } from '../../index.js';

@readModel()
class SlowItem {
    static readonly source = new CurrentValueSubject<number>(1);
    @query({ observable: true })
    static async pending(): Promise<ObservableSource<number>> {
        await new Promise(resolve => setTimeout(resolve, 80));
        return SlowItem.source;
    }
}

describe('when opening an observable query that never finishes', () => {
    let scenario: ObservableQueryScenario<number>;
    let failure: unknown;
    beforeEach(async () => {
        scenario = ObservableQueryScenario.for<number>(SlowItem, 'pending');
        try { await scenario.collect(1, 25); } catch (error) { failure = error; }
    });
    afterEach(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        await scenario.dispose();
    });
    it('should fail at the opening deadline', () => {
        (failure as Error).message.should.contain('Timed out waiting');
    });
});
