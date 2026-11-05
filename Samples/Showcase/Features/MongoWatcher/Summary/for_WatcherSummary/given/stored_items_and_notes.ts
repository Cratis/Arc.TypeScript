// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ObservableQueryScenario } from '@cratis/arc.testing';
import { MongoTestDatabase } from '../../../given/a_mongodb_database.js';
import { WatcherSummary } from '../../Summary.js';
import { metadata } from '../../../../generatedMetadata.js';

export class stored_items_and_notes {
    database = new MongoTestDatabase();
    observable = ObservableQueryScenario.for<{ itemCount: number; noteCount: number; latestNote: string }>(WatcherSummary, 'observeSummary');

    constructor() {
        this.observable.extend(builder => { builder.useGeneratedMetadata(metadata); this.database.install(builder); });
        this.observable.withContext({ tenantId: 'acme' });
    }

    async dispose(): Promise<void> { await this.observable.dispose(); await this.database.dispose(); }
}
