// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { ArcApplication } from '@cratis/arc.core';
import { given } from '../../given.js';
import { TaskRecord } from '../../for_DrizzleReadModels/given/TaskRecord.js';
import { a_sqlite_database } from '../../for_DrizzleReadModels/given/a_sqlite_database.js';
import '../../index.js';

should();
describe('when registering a compound primary key for command resolution', given(a_sqlite_database, () => {
    let failure: Error | undefined;
    beforeEach(() => {
        const table = sqliteTable('compound', { id: text('id'), locale: text('locale'), title: text('title') },
            columns => [primaryKey({ columns: [columns.id, columns.locale] })]);
        try {
            ArcApplication.createBuilder().withDrizzle({ dialect: 'sqlite', database: {},
                readModels: [{ type: TaskRecord, table }] });
        } catch (error) { failure = error as Error; }
    });
    it('should reject the ambiguous command key mapping before serving requests', () => {
        failure!.message.should.contain('compound keys cannot be resolved by command key');
    });
}));
