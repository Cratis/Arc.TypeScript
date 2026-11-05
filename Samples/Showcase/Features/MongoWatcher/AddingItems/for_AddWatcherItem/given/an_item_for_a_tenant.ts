// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario } from '@cratis/arc.testing';
import { MongoTestDatabase } from '../../../given/a_mongodb_database.js';
import { AddWatcherItem, AddWatcherItemValidator } from '../../AddingItems.js';
import { metadata } from '../../../../generatedMetadata.js';

export class an_item_for_a_tenant {
    database = new MongoTestDatabase();
    scenario = CommandScenario.for(AddWatcherItem, AddWatcherItemValidator);

    constructor() {
        this.scenario.extend(builder => { builder.useGeneratedMetadata(metadata); this.database.install(builder); });
    }

    async itemsOf(tenant: string): Promise<string[]> {
        const documents = await this.database.client.db(`${this.database.prefix}_${tenant}`).collection('WatcherItems').find().toArray();
        return documents.map(document => String(document.name));
    }

    async dispose(): Promise<void> { await this.scenario.dispose(); await this.database.dispose(); }
}
