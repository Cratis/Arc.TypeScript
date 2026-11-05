// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, validator } from '@cratis/arc.core';
import { ChangeStreamStore } from '../ChangeStreamStore.js';

/** Add an item; observers receive it in the `added` list of a change set. */
@command()
export class AddChangeStreamItem {
    @field(String) name!: string;
    @field(Number) value!: number;

    handle(items: ChangeStreamStore): void { items.add(this.name, this.value); }
}

@validator(AddChangeStreamItem)
export class AddChangeStreamItemValidator extends CommandValidator<AddChangeStreamItem> {
    constructor() {
        super();
        this.ruleFor(command => command.name).notEmpty().withMessage('A name is required');
    }
}
