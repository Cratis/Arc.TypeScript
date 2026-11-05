// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field, Guid } from '@cratis/fundamentals';
import { query, readModel } from '@cratis/arc.core';
import type { BehaviorSubject } from 'rxjs';
import { ObservableCollectionWithGuidStore } from '../ObservableCollectionWithGuidStore.js';

/** An item of the observable collection. */
@readModel()
export class ObservableCollectionWithGuidItem {
    @field(Guid) id!: Guid;
    @field(String) name!: string;

    @query()
    static all(items: ObservableCollectionWithGuidStore): BehaviorSubject<ObservableCollectionWithGuidItem[]> { return items.all(); }
}
