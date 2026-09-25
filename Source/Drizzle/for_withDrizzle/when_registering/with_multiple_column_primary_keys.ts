// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { given } from '../../given.js';
import { DrizzleDialect } from '../../DrizzleDialect.js';
import { TaskRecord } from '../../for_DrizzleReadModels/given/TaskRecord.js';
import { a_builder } from '../given/a_builder.js';
import '../../index.js';

should();
describe('when registering several column primary keys for queries', given(a_builder, context => {
    const table = sqliteTable('compound', {
        id: text('id').primaryKey(), locale: text('locale').primaryKey(), title: text('title')
    });
    let registered: typeof context.builder;
    beforeEach(() => {
        registered = context.builder.withDrizzle({ dialect: DrizzleDialect.SQLite, database: {},
            readModels: [{ type: TaskRecord, table }] });
    });
    it('should retain the query registration', () => { registered.should.equal(context.builder); });
}));
