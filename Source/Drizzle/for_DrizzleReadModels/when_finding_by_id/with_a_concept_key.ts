// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { Guid } from '@cratis/fundamentals';
import { conceptCodec } from '../../ColumnCodec.js';
import { sqliteColumn } from '../../columns.js';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { given } from '../../given.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';
import { ConceptTask } from '../given/ConceptTask.js';
import { TaskId } from '../given/TaskId.js';

should();
describe('when finding a Drizzle row by a GUID concept key', given(a_sqlite_database, context => {
    const table = sqliteTable('concept_tasks', {
        id: sqliteColumn(conceptCodec(TaskId, 'guid', 'sqlite'))('id').primaryKey(),
        title: text('title').notNull()
    });
    let record: ConceptTask | null;
    beforeEach(async () => {
        await context.establish();
        context.native.run('create table concept_tasks (id text primary key, title text not null)');
        context.database.insert(table).values({ id: new TaskId(Guid.parse('00112233-4455-6677-8899-aabbccddeeff')),
            title: 'concept row' }).run();
        record = await new DrizzleReadModels(context.database, table, ConceptTask)
            .findById('00112233-4455-6677-8899-aabbccddeeff');
    });
    afterEach(() => context.close());
    it('should pass a typed concept through the column encoder', () => {
        should().exist(record);
        record!.title.should.equal('concept row');
        record!.id.should.be.instanceOf(TaskId);
    });
}));
