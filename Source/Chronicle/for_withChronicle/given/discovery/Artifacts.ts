// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { fromEvent } from '@cratis/chronicle/projections';
import { command, commandReadModel, inject, key, query, readModel, service } from '@cratis/arc.core';
import { ChronicleReadModels } from '../../../ChronicleReadModels.js';

@eventType()
export class ItemCreated { @field(String) name = ''; }

@command()
export class CreateItem {
    @field(String) @key() id = '';
    handle(): ItemCreated { return new ItemCreated(); }
}

@readModel()
@fromEvent(ItemCreated)
export class Item {
    @field(String) id = '';
    @field(String) name = '';

    @query(service(ChronicleReadModels))
    static all(models: ChronicleReadModels): Promise<Item[]> { return models.getAll(Item); }
}

@command()
export class ReadItem {
    @field(String) @key() id = '';
    @inject(commandReadModel(Item)) handle(item: Item): string { return item.name; }
}
