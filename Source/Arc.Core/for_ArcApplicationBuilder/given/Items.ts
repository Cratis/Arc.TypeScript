// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ItemName } from './ItemName.js';
export class Items {
    readonly values: ItemName[] = [];
    add(item: ItemName): void { this.values.push(item); }
}
