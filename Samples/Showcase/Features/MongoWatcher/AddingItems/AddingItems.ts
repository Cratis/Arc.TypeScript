// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field, Guid } from '@cratis/fundamentals';
import { command, CommandValidator, inject, validator } from '@cratis/arc.core';
import { mongoCollection, type MongoCollection } from '@cratis/arc.mongodb';
import { WatcherItem } from '../WatcherItem.js';

/** Add an item to the current tenant's collection. */
@command()
export class AddWatcherItem {
    @field(String) name!: string;

    @inject(mongoCollection(WatcherItem))
    async handle(items: MongoCollection<WatcherItem>): Promise<void> {
        await items.native.insertOne(items.codec.serialize({ id: Guid.create(), name: this.name }));
    }
}

@validator(AddWatcherItem)
export class AddWatcherItemValidator extends CommandValidator<AddWatcherItem> {
    constructor() {
        super();
        this.ruleFor(command => command.name).notEmpty().withMessage('A name is required');
    }
}
