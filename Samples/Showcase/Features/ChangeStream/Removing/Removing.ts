// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command } from '@cratis/arc.core';
import { ChangeStreamStore } from '../ChangeStreamStore.js';

/** Remove an item; observers receive it in the `removed` list of a change set. */
@command()
export class RemoveChangeStreamItem {
    @field(Number) id!: number;

    handle(items: ChangeStreamStore): void { items.remove(this.id); }
}
