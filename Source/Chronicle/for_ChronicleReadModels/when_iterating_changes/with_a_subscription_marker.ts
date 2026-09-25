// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '@cratis/arc.core';
import type { IEventStore } from '@cratis/chronicle';
import type { ReadModelChangeset } from '@cratis/chronicle/readModels';
import { ChronicleReadModels } from '../../ChronicleReadModels.js';
import type { ChronicleRuntime } from '../../ChronicleRuntime.js';

class Item {}

describe('when iterating changes with a subscription marker', () => {
    const change = { key: '1', readModel: new Item(), removed: false };
    const store = { readModels: { async *watch() {
        yield { key: '', readModel: new Item(), removed: false };
        yield change;
    } } } as unknown as IEventStore;
    const models = new ChronicleReadModels({ getStore: async () => store } as unknown as ChronicleRuntime,
        { tenantId: 'tenant' } as ExecutionContext);
    let result: IteratorResult<ReadModelChangeset<Item>>;
    beforeEach(async () => { result = await models.watchIterable(Item)[Symbol.asyncIterator]().next(); });
    it('should skip the subscription marker', () => { result.value.should.equal(change); });
});
