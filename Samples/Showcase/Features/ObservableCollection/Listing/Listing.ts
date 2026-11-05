// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { query, readModel } from '@cratis/arc.core';
import type { BehaviorSubject } from 'rxjs';
import { ObservableCollectionStore } from '../ObservableCollectionStore.js';

/** An item of the observable collection. */
@readModel()
export class ObservableCollectionItem {
    @field(Number) id!: number;
    @field(String) name!: string;

    @query()
    static all(items: ObservableCollectionStore): BehaviorSubject<ObservableCollectionItem[]> { return items.all(); }
}
