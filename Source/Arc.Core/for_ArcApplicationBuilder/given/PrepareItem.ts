// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, inject } from '../../index.js';
import { ItemName } from './ItemName.js';
import { Items } from './Items.js';

@command()
export class PrepareItem {
    @field(ItemName) name!: ItemName;
    prepared = false;
    provide(): ItemName { this.prepared = true; return new ItemName(this.name.value.toUpperCase()); }
    @inject(Items)
    handle(prepared: ItemName, items: Items): string {
        if (!this.prepared) throw new Error('Command instance changed after preparation');
        items.add(prepared);
        return prepared.value;
    }
}
