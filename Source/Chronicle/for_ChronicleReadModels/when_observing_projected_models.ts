// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { firstValueFrom, take, toArray } from 'rxjs';
import type { IEventStore } from '@cratis/chronicle';
import type { ExecutionContext } from '@cratis/arc.core';
import { ChronicleReadModels } from '../ChronicleReadModels.js';
import type { ChronicleRuntime } from '../ChronicleRuntime.js';

class Item {
    constructor(readonly id: string, readonly name: string) {}
}

const modelsFor = (initial: Item[], changes: { key: string; readModel: Item; removed: boolean }[]) => {
    const store = { readModels: {
        getInstances: async () => initial,
        findInstanceById: async (_type: typeof Item, id: string) => initial.find(item => item.id === id) ?? null,
        async *watch() { for (const change of changes) yield change; }
    } } as unknown as IEventStore;
    const runtime = { getStore: async () => store } as unknown as ChronicleRuntime;
    return new ChronicleReadModels(runtime, { tenantId: 'tenant' } as ExecutionContext);
};

describe('when observing projected read models', () => {
    it('should combine the snapshot with updates and removals', async () => {
        const initial = new Item('1', 'before');
        const updated = new Item('1', 'after');
        const models = modelsFor([initial], [
            { key: '1', readModel: updated, removed: false },
            { key: '1', readModel: updated, removed: true }
        ]);
        const emissions = await firstValueFrom(models.observeAll(Item).pipe(take(3), toArray()));
        emissions.should.deep.equal([[initial], [updated], []]);
    });

    it('should ignore other keys when observing one ID', async () => {
        const item = new Item('1', 'one');
        const other = new Item('2', 'two');
        const models = modelsFor([item, other], [
            { key: '2', readModel: other, removed: false },
            { key: '1', readModel: item, removed: true }
        ]);
        const emissions = await firstValueFrom(models.observeById(Item, '1').pipe(take(2), toArray()));
        emissions.should.deep.equal([item, null]);
    });

    it('should return tenant-scoped snapshots by type and ID', async () => {
        const item = new Item('1', 'one');
        const models = modelsFor([item], []);
        (await models.getAll(Item)).should.deep.equal([item]);
        const found = await models.getById(Item, '1');
        (found === item).should.equal(true);
        (await models.getById(Item, 'missing') === null).should.equal(true);
    });
});
