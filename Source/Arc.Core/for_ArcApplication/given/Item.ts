// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field, Guid } from '@cratis/fundamentals';
import { query, readModel, service, argument } from '../../index.js';
import { ItemName } from './ItemName.js';
import { Items } from './Items.js';
@readModel()
export class Item {
    @field(ItemName) name!: ItemName;
    @query(service(Items))
    static all(items: Items): Item[] { return items.values.map(name => Object.assign(new Item(), { name })); }
    @query(argument('name', ItemName), service(Items))
    static byName(name: ItemName, items: Items): Item | undefined {
        return items.values.some(value => value.value === name.value) ? Object.assign(new Item(), { name }) : undefined;
    }
    @query(argument('id', Guid))
    static byGuid(id: Guid): Item | undefined { void id; return undefined; }
}
