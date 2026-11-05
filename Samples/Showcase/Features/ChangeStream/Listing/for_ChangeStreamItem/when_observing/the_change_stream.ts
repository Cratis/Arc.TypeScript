// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ObservableQueryScenario, given } from '@cratis/arc.testing';
import { ChangeStreamStore } from '../../../ChangeStreamStore.js';
import { ChangeStreamItem } from '../../Listing.js';
import { metadata } from '../../../../generatedMetadata.js';

describe('when observing the change stream', given(class {
    items = new ChangeStreamStore();
    observable = ObservableQueryScenario.for<{ id: number; value: number }[]>(ChangeStreamItem, 'all');
    constructor() {
        this.observable.extend(builder => builder.useGeneratedMetadata(metadata));
        this.observable.services.addSingleton(ChangeStreamStore, this.items);
    }
}, context => {
    let result: Awaited<ReturnType<typeof context.observable.collect>>;
    beforeEach(async () => {
        context.items.add('First', 1);
        result = await context.observable.collect(1, 1_000);
    });
    afterAll(async () => { await context.observable.dispose(); });
    it('should emit the current items', () => { result.emissions[0]?.data?.should.have.lengthOf(1); });
}));
