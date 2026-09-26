// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { given } from '../../given.js';
import { DrizzleDialect } from '../../DrizzleDialect.js';
import { TaskRecord } from '../../for_DrizzleReadModels/given/TaskRecord.js';
import { a_builder } from '../given/a_builder.js';
import '../../index.js';

should();
describe('when registering a table-level composite primary key', given(a_builder, context => {
    const table = sqliteTable('composite_tasks', { id: text('id'), locale: text('locale'), title: text('title') },
        columns => [primaryKey({ columns: [columns.id, columns.locale] })]);
    let failure: Error | undefined;
    beforeEach(() => {
        try {
            context.builder.withDrizzle({ dialect: DrizzleDialect.SQLite, database: {}, readModels: [{ type: TaskRecord, table }] });
        } catch (error) { failure = error as Error; }
    });
    it('should reject the model at registration because no column declares a primary key', () => {
        should().exist(failure);
        failure!.message.should.equal('A Drizzle read model requires a primary key for stable paging');
    });
}));
