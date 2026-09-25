// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { firstValueFrom, take, toArray } from 'rxjs';
import type { IEventStore } from '@cratis/chronicle';
import type { ExecutionContext } from '@cratis/arc.core';
import { given } from '../../given.js';
import { ChronicleReadModels } from '../../ChronicleReadModels.js';
import type { ChronicleRuntime } from '../../ChronicleRuntime.js';

class Item { constructor(readonly id: string) {} }

class a_watch_with_an_empty_initial_change {
    readonly item = new Item('one');
    readonly store = { readModels: {
        getInstances: async () => [this.item],
        async *watch() {
            yield { key: '', readModel: {} as Item, removed: false };
            yield { key: undefined, readModel: {} as Item, removed: false };
            yield { key: 'one', readModel: new Item('one'), removed: true };
        }
    } } as unknown as IEventStore;
    readonly models = new ChronicleReadModels(
        { getStore: async () => this.store } as unknown as ChronicleRuntime,
        { tenantId: 'tenant' } as ExecutionContext);
}

describe('when observing projected models with an empty initial change', given(a_watch_with_an_empty_initial_change, context => {
    let emissions: Item[][];
    beforeEach(async () => {
        emissions = await firstValueFrom(context.models.observeAll(Item).pipe(take(2), toArray()));
    });
    it('should keep only the snapshot and the legitimate removal', () => {
        emissions.should.deep.equal([[context.item], []]);
    });
}));
