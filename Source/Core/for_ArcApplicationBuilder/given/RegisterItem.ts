// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, inject } from '../../index.js';
import { ItemName } from './ItemName.js';
import { Items } from './Items.js';
@command()
export class RegisterItem {
    @field(ItemName) name!: ItemName;
    @inject(Items)
    handle(items: Items): ItemName { items.add(this.name); return this.name; }
}
