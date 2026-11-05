// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario } from '@cratis/arc.testing';
import { MongoTestDatabase } from '../../../given/a_mongodb_database.js';
import { AddWatcherNote, AddWatcherNoteValidator } from '../../AddingNotes.js';
import { metadata } from '../../../../generatedMetadata.js';

export class a_note_for_a_tenant {
    database = new MongoTestDatabase();
    scenario = CommandScenario.for(AddWatcherNote, AddWatcherNoteValidator);

    constructor() {
        this.scenario.extend(builder => { builder.useGeneratedMetadata(metadata); this.database.install(builder); });
        this.scenario.withContext({ tenantId: 'acme' });
    }

    async notes(): Promise<string[]> {
        const documents = await this.database.client.db(`${this.database.prefix}_acme`).collection('WatcherNotes').find().toArray();
        return documents.map(document => String(document.text));
    }

    async dispose(): Promise<void> { await this.scenario.dispose(); await this.database.dispose(); }
}
