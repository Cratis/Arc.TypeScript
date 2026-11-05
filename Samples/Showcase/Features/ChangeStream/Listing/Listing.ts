// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { query, readModel } from '@cratis/arc.core';
import type { BehaviorSubject } from 'rxjs';
import { ChangeStreamStore } from '../ChangeStreamStore.js';

/** An item of the change stream. Items are matched across emissions by `id`. */
@readModel()
export class ChangeStreamItem {
    @field(Number) id!: number;
    @field(String) name!: string;
    @field(Number) value!: number;

    @query()
    static all(items: ChangeStreamStore): BehaviorSubject<ChangeStreamItem[]> { return items.all(); }
}
