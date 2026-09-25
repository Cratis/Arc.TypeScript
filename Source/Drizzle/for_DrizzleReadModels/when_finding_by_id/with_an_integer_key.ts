// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { given } from '../../given.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';
import { NumberTask } from '../given/NumberTask.js';

should();
describe('when finding by an integer key', given(a_sqlite_database, context => {
    const table = sqliteTable('number_tasks', { id: integer('id').primaryKey(), title: text('title') });
    let record: NumberTask | null;
    beforeEach(async () => {
        await context.establish();
        context.native.run('create table number_tasks (id integer primary key, title text)');
        context.native.run("insert into number_tasks values (12, 'number row')");
        record = await new DrizzleReadModels(context.database, table, NumberTask).findById('12');
    });
    afterEach(() => context.close());
    it('should bind the integer value', () => {
        should().exist(record);
        record!.id.should.equal(12);
        record!.title.should.equal('number row');
    });
}));
