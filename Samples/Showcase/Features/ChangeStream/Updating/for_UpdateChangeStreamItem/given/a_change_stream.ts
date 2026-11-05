// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario } from '@cratis/arc.testing';
import { ChangeStreamStore } from '../../../ChangeStreamStore.js';
import { UpdateChangeStreamItem } from '../../Updating.js';
import { metadata } from '../../../../generatedMetadata.js';

export class a_change_stream {
    items = new ChangeStreamStore();
    scenario = CommandScenario.for(UpdateChangeStreamItem);

    constructor() {
        this.scenario.extend(builder => builder.useGeneratedMetadata(metadata));
        this.scenario.services.addSingleton(ChangeStreamStore, this.items);
    }
}
