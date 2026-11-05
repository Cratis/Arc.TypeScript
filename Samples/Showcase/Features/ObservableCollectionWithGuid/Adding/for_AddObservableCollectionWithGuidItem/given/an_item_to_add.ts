// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario } from '@cratis/arc.testing';
import { ObservableCollectionWithGuidStore } from '../../../ObservableCollectionWithGuidStore.js';
import { AddObservableCollectionWithGuidItem, AddObservableCollectionWithGuidItemValidator } from '../../Adding.js';
import { metadata } from '../../../../generatedMetadata.js';

export class an_item_to_add {
    items = new ObservableCollectionWithGuidStore();
    scenario = CommandScenario.for(AddObservableCollectionWithGuidItem, AddObservableCollectionWithGuidItemValidator);

    constructor() {
        this.scenario.extend(builder => builder.useGeneratedMetadata(metadata));
        this.scenario.services.addSingleton(ObservableCollectionWithGuidStore, this.items);
    }
}
