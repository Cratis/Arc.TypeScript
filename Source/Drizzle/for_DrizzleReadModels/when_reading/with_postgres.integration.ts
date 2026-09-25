// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { Pool } from 'pg';
import postgres from 'postgres';
import { drizzle as nodePostgres } from 'drizzle-orm/node-postgres';
import { drizzle as postgresJs } from 'drizzle-orm/postgres-js';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { ConceptAs, DateOnly, field, Guid, TimeOnly } from '@cratis/fundamentals';
import { conceptCodec, dateOnlyCodec, guidCodec, jsonCodec, timeOnlyCodec } from '../../ColumnCodec.js';
import { pgColumn } from '../../columns.js';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';

should();
class TaskName extends ConceptAs<string> { static readonly valueType = String; }
class RichRecord {
    @field(Guid) id!: Guid;
    @field(String) title!: string;
    @field(TaskName) name!: TaskName;
    @field(DateOnly) date!: DateOnly;
    @field(TimeOnly) time!: TimeOnly;
    @field(Object) details!: { label: string };
}
const table = pgTable('tasks', {
    id: pgColumn(guidCodec('postgresql'))('id').primaryKey(),
    title: text('title').notNull(),
    name: pgColumn(conceptCodec(TaskName, 'string', 'postgresql'))('name').notNull(),
    date: pgColumn(dateOnlyCodec)('date').notNull(),
    time: pgColumn(timeOnlyCodec)('time').notNull(),
    details: pgColumn(jsonCodec('postgresql', value => {
        if (!value || typeof value !== 'object' || typeof Reflect.get(value, 'label') !== 'string')
            throw new Error('Invalid details');
        return value as { label: string };
    }))('details').notNull()
});

describe('when reading PostgreSQL with both supported drivers', () => {
    let pool: Pool;
    let client: ReturnType<typeof postgres>;
    beforeEach(async () => {
        if (!process.env.ARC_POSTGRES_TEST_URI) throw new Error('ARC_POSTGRES_TEST_URI is required');
        pool = new Pool({ connectionString: process.env.ARC_POSTGRES_TEST_URI });
        client = postgres(process.env.ARC_POSTGRES_TEST_URI);
        await pool.query('create table tasks (id uuid primary key, title text not null, name text not null, date date not null, time time not null, details jsonb not null)');
    });
    afterEach(async () => {
        await pool.query('drop table tasks');
        await pool.end();
        await client.end();
    });
    for (const driver of ['node-postgres', 'postgres-js'] as const) {
        it(`should decode UUID, concepts, dates, times, JSON, counts and pages through ${driver}`, async () => {
            const db = driver === 'node-postgres' ? nodePostgres(pool) : postgresJs(client);
            const id = Guid.parse('00112233-4455-6677-8899-aabbccddeeff');
            await db.insert(table).values([
                { id, title: 'z', name: new TaskName('first'), date: DateOnly.parse('2026-03-02'),
                    time: TimeOnly.parse('12:34:56'), details: { label: 'one' } },
                { id: Guid.parse('11112233-4455-6677-8899-aabbccddeeff'), title: 'a', name: new TaskName('second'),
                    date: DateOnly.parse('2026-03-03'), time: TimeOnly.parse('13:34:56'), details: { label: 'two' } }
            ]);
            const models = new DrizzleReadModels(db, table, RichRecord);
            const page = await models.queryPage(undefined, { paging: { page: 0, pageSize: 1 },
                sorting: { field: 'title', direction: 'asc' } });
            page.items[0]!.title.should.equal('a');
            page.items[0]!.id.should.be.instanceOf(Guid);
            page.items[0]!.name.should.be.instanceOf(TaskName);
            page.items[0]!.date.toString().should.equal('2026-03-03');
            page.items[0]!.time.toString().should.equal('13:34:56');
            page.items[0]!.details.should.deep.equal({ label: 'two' });
            page.totalItems.should.equal(2);
        });
    }
});
