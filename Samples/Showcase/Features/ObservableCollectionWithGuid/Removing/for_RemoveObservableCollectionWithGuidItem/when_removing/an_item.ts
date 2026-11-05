// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario, given } from '@cratis/arc.testing';
import { ObservableCollectionWithGuidStore } from '../../../ObservableCollectionWithGuidStore.js';
import { RemoveObservableCollectionWithGuidItem } from '../../Removing.js';
import { metadata } from '../../../../generatedMetadata.js';

describe('when removing an item from the collection', given(class {
    items = new ObservableCollectionWithGuidStore();
    scenario = CommandScenario.for(RemoveObservableCollectionWithGuidItem);
    constructor() {
        this.scenario.extend(builder => builder.useGeneratedMetadata(metadata));
        this.scenario.services.addSingleton(ObservableCollectionWithGuidStore, this.items);
    }
}, context => {
    beforeAll(async () => {
        context.items.add('Kept');
        const removed = context.items.add('Removed');
        (await context.scenario.execute({ id: removed.id })).shouldBeSuccessful();
    });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should leave only the other items', () => { context.items.all().value.map(item => item.name).should.deep.equal(['Kept']); });
}));
