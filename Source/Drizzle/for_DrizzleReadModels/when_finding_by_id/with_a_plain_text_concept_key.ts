// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { given } from '../../given.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';
import { ConceptTask } from '../given/ConceptTask.js';
import { TaskId } from '../given/TaskId.js';

should();
describe('when finding by a plain text concept key', given(a_sqlite_database, context => {
    const table = sqliteTable('plain_concept_tasks', { id: text('id').primaryKey(), title: text('title') });
    let record: ConceptTask | null;
    beforeEach(async () => {
        await context.establish();
        context.native.run('create table plain_concept_tasks (id text primary key, title text)');
        context.native.run("insert into plain_concept_tasks values ('00112233-4455-6677-8899-aabbccddeeff', 'concept row')");
        record = await new DrizzleReadModels(context.database, table, ConceptTask)
            .findById('00112233-4455-6677-8899-aabbccddeeff');
    });
    afterEach(() => context.close());
    it('should bind the concept primitive and decode its field', () => {
        should().exist(record);
        record!.id.should.be.instanceOf(TaskId);
        record!.title.should.equal('concept row');
    });
}));
