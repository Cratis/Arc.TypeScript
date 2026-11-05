// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command } from '@cratis/arc.core';
import { ObservableCollectionStore } from '../ObservableCollectionStore.js';

/** Remove an item from the collection. */
@command()
export class RemoveObservableCollectionItem {
    @field(Number) id!: number;

    handle(items: ObservableCollectionStore): void { items.remove(this.id); }
}
