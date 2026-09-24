// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CurrentValueSubject, query, readModel, service, type ObservableSource } from '@cratis/arc.core';
import { ObservableQueryScenario } from '../../index.js';

class TrackedResource { [Symbol.dispose](): void { SlowItem.disposed++; } }
@readModel()
class SlowItem {
    static disposed = 0;
    static readonly source = new CurrentValueSubject<number>(1);
    @query({ observable: true }, service(TrackedResource))
    static async pending(_resource: TrackedResource): Promise<ObservableSource<number>> {
        void _resource;
        await new Promise(resolve => setTimeout(resolve, 80));
        return SlowItem.source;
    }
}

describe('when opening an observable query that never finishes', () => {
    let scenario: ObservableQueryScenario<number>;
    let failure: unknown;
    beforeEach(async () => {
        SlowItem.disposed = 0;
        scenario = ObservableQueryScenario.for<number>(SlowItem, 'pending');
        scenario.services.addScoped(TrackedResource, () => new TrackedResource());
        try { await scenario.collect(1, 25); } catch (error) { failure = error; }
        await new Promise(resolve => setTimeout(resolve, 100));
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should fail at the opening deadline', () => {
        (failure as Error).message.should.contain('Timed out waiting');
    });
    it('should close a session that opens after the deadline', () => {
        SlowItem.disposed.should.equal(1);
    });
});
