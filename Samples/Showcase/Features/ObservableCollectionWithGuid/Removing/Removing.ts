// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field, Guid } from '@cratis/fundamentals';
import { command } from '@cratis/arc.core';
import { ObservableCollectionWithGuidStore } from '../ObservableCollectionWithGuidStore.js';

/** Remove an item from the collection. */
@command()
export class RemoveObservableCollectionWithGuidItem {
    @field(Guid) id!: Guid;

    handle(items: ObservableCollectionWithGuidStore): void { items.remove(this.id); }
}
