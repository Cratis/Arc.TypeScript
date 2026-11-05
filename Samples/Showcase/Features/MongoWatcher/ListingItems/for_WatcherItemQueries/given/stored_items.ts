// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryScenario } from '@cratis/arc.testing';
import { MongoTestDatabase } from '../../../given/a_mongodb_database.js';
import { WatcherItemQueries } from '../../ListingItems.js';
import { metadata } from '../../../../generatedMetadata.js';

export class stored_items {
    database = new MongoTestDatabase();
    all = QueryScenario.for<{ name: string }[]>(WatcherItemQueries, 'all');

    constructor() {
        this.all.extend(builder => { builder.useGeneratedMetadata(metadata); this.database.install(builder); });
        this.all.withContext({ tenantId: 'acme' });
    }

    store(...names: string[]): Promise<void> { return this.database.insertItems('acme', ...names); }

    async dispose(): Promise<void> { await this.all.dispose(); await this.database.dispose(); }
}
