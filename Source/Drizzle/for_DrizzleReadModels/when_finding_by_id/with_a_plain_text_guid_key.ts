// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { field, Guid } from '@cratis/fundamentals';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { given } from '../../given.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';

should();
class PlainGuidTask { @field(Guid) id!: Guid; @field(String) title!: string; }
describe('when finding by a plain text GUID key', given(a_sqlite_database, context => {
    const table = sqliteTable('plain_guid_tasks', { id: text('id').primaryKey(), title: text('title') });
    let record: PlainGuidTask | null;
    beforeEach(async () => {
        await context.establish();
        context.native.run('create table plain_guid_tasks (id text primary key, title text)');
        context.native.run("insert into plain_guid_tasks values ('00112233-4455-6677-8899-aabbccddeeff', 'plain row')");
        record = await new DrizzleReadModels(context.database, table, PlainGuidTask)
            .findById('00112233-4455-6677-8899-aabbccddeeff');
    });
    afterEach(() => context.close());
    it('should bind text and decode the model GUID', () => {
        should().exist(record);
        record!.id.should.be.instanceOf(Guid);
        record!.title.should.equal('plain row');
    });
}));
