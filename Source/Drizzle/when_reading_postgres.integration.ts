// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { Guid } from '@cratis/fundamentals';
import { guidCodec } from './ColumnCodec.js';
import { pgColumn } from './columns.js';
import { DrizzleReadModels } from './DrizzleReadModels.js';
import { TaskRecord } from './for_DrizzleReadModels/given/TaskRecord.js';

should();
describe('when reading PostgreSQL', () => {
    const table = pgTable('tasks', {
        id: pgColumn(guidCodec('postgresql'))('id').primaryKey(),
        title: text('title').notNull()
    });
    let pool: Pool;
    beforeEach(async () => {
        if (!process.env.ARC_POSTGRES_TEST_URI) throw new Error('ARC_POSTGRES_TEST_URI is required');
        pool = new Pool({ connectionString: process.env.ARC_POSTGRES_TEST_URI });
        await pool.query('create table tasks (id uuid primary key, title text not null)');
    });
    afterEach(async () => { await pool.query('drop table tasks'); await pool.end(); });
    it('should store UUIDs and count and page inside PostgreSQL', async () => {
        const db = drizzle(pool);
        await db.insert(table).values([
            { id: Guid.parse('00112233-4455-6677-8899-aabbccddeeff'), title: 'z' },
            { id: Guid.parse('11112233-4455-6677-8899-aabbccddeeff'), title: 'a' }
        ]);
        const models = new DrizzleReadModels(db, 'postgresql', table, TaskRecord);
        const page = await models.queryPage(undefined, { paging: { page: 0, pageSize: 1 },
            sorting: { field: 'title', direction: 'asc' } });
        page.items[0]!.title.should.equal('a');
        page.items[0]!.id.should.be.instanceOf(Guid);
        page.totalItems.should.equal(2);
    });
});
