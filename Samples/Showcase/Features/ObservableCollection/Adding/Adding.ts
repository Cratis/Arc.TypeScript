// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, validator } from '@cratis/arc.core';
import { ObservableCollectionStore } from '../ObservableCollectionStore.js';

/** Add an item to the collection. */
@command()
export class AddObservableCollectionItem {
    @field(String) name!: string;

    handle(items: ObservableCollectionStore): void { items.add(this.name); }
}

@validator(AddObservableCollectionItem)
export class AddObservableCollectionItemValidator extends CommandValidator<AddObservableCollectionItem> {
    constructor() {
        super();
        this.ruleFor(command => command.name).notEmpty().withMessage('A name is required');
    }
}
