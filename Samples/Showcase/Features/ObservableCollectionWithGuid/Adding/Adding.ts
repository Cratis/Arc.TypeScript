// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, validator } from '@cratis/arc.core';
import { ObservableCollectionWithGuidStore } from '../ObservableCollectionWithGuidStore.js';

/** Add an item to the collection. */
@command()
export class AddObservableCollectionWithGuidItem {
    @field(String) name!: string;

    handle(items: ObservableCollectionWithGuidStore): void { items.add(this.name); }
}

@validator(AddObservableCollectionWithGuidItem)
export class AddObservableCollectionWithGuidItemValidator extends CommandValidator<AddObservableCollectionWithGuidItem> {
    constructor() {
        super();
        this.ruleFor(command => command.name).notEmpty().withMessage('A name is required');
    }
}
