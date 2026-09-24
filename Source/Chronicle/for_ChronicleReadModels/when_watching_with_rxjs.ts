// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { firstValueFrom, Observable } from 'rxjs';
import type { IEventStore } from '@cratis/chronicle';
import type { ExecutionContext } from '@cratis/arc.core';
import { ChronicleReadModels } from '../ChronicleReadModels.js';
import type { ChronicleRuntime } from '../ChronicleRuntime.js';

class Item {}

describe('when watching Chronicle read models with RxJS', () => {
    it('should yield changes from the selected tenant as an Observable', async () => {
        const changes = { namespace: 'tenant', key: '1', readModel: new Item(), removed: false };
        const store = { readModels: { async *watch() { yield changes; } } } as unknown as IEventStore;
        const runtime = { getStore: async () => store } as unknown as ChronicleRuntime;
        const models = new ChronicleReadModels(runtime, { tenantId: 'tenant' } as ExecutionContext);
        const source = models.watch(Item);
        source.should.be.instanceOf(Observable);
        (await firstValueFrom(source)).should.equal(changes);
    });

    it('should release the underlying iterator when the subscriber unsubscribes', async () => {
        let released = false;
        const changes = { namespace: 'tenant', key: '1', readModel: new Item(), removed: false };
        const store = { readModels: { async *watch() {
            try { yield changes; } finally { released = true; }
        } } } as unknown as IEventStore;
        const runtime = { getStore: async () => store } as unknown as ChronicleRuntime;
        const models = new ChronicleReadModels(runtime, { tenantId: 'tenant' } as ExecutionContext);
        await firstValueFrom(models.watch(Item));
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        released.should.equal(true);
    });
});
