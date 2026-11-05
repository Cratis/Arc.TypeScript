// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario } from '@cratis/arc.testing';
import { ObservableCollectionStore } from '../../../ObservableCollectionStore.js';
import { AddObservableCollectionItem, AddObservableCollectionItemValidator } from '../../Adding.js';
import { metadata } from '../../../../generatedMetadata.js';

export class an_item_to_add {
    items = new ObservableCollectionStore();
    scenario = CommandScenario.for(AddObservableCollectionItem, AddObservableCollectionItemValidator);

    constructor() {
        this.scenario.extend(builder => builder.useGeneratedMetadata(metadata));
        this.scenario.services.addSingleton(ObservableCollectionStore, this.items);
    }
}
