// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ObservableQueryScenario, given } from '@cratis/arc.testing';
import { ObservableCollectionStore } from '../../../ObservableCollectionStore.js';
import { ObservableCollectionItem } from '../../Listing.js';
import { metadata } from '../../../../generatedMetadata.js';

describe('when observing the collection', given(class {
    items = new ObservableCollectionStore();
    observable = ObservableQueryScenario.for<{ name: string }[]>(ObservableCollectionItem, 'all');
    constructor() {
        this.observable.extend(builder => builder.useGeneratedMetadata(metadata));
        this.observable.services.addSingleton(ObservableCollectionStore, this.items);
    }
}, context => {
    let result: Awaited<ReturnType<typeof context.observable.collect>>;
    beforeEach(async () => {
        context.items.add('First');
        result = await context.observable.collect(1, 1_000);
    });
    afterAll(async () => { await context.observable.dispose(); });
    it('should emit the current items', () => { result.emissions[0]?.data?.map(item => item.name).should.deep.equal(['First']); });
}));
