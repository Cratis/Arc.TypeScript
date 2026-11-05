// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command } from '@cratis/arc.core';
import { ChangeStreamStore } from '../ChangeStreamStore.js';

/** Change an item's value; observers receive it in the `replaced` list of a change set. */
@command()
export class UpdateChangeStreamItem {
    @field(Number) id!: number;
    @field(Number) value!: number;

    handle(items: ChangeStreamStore): void { items.update(this.id, this.value); }
}
