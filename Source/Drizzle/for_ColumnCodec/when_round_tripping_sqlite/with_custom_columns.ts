// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DrizzleDialect } from '../../DrizzleDialect.js';
import { ConceptCodecKind } from '../../ConceptCodecKind.js';
import { describe, it, should } from 'vitest';
import initSqlJs from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import { sqliteTable } from 'drizzle-orm/sqlite-core';
import { ConceptAs, DateOnly, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import { conceptCodec, dateOnlyCodec, guidCodec, jsonCodec, timeOnlyCodec, timeSpanCodec } from '../../ColumnCodec.js';
import { sqliteColumn } from '../../columns.js';

should();
class TaskName extends ConceptAs<string> { static readonly valueType = String; }
class TaskScore extends ConceptAs<number> { static readonly valueType = Number; }
class TaskId extends ConceptAs<Guid> { static readonly valueType = Guid; }

describe('when round-tripping SQLite custom columns', () => {
    it('should reconstruct each concrete Fundamentals type and validated JSON through the Drizzle driver', async () => {
        const SQL = await initSqlJs();
        const connection = new SQL.Database();
        try {
            const records = sqliteTable('records', {
                id: sqliteColumn(guidCodec(DrizzleDialect.SQLite))('id').primaryKey(),
                conceptId: sqliteColumn(conceptCodec(TaskId, ConceptCodecKind.Guid, DrizzleDialect.SQLite))('concept_id').notNull(),
                name: sqliteColumn(conceptCodec(TaskName, ConceptCodecKind.String, DrizzleDialect.SQLite))('name').notNull(),
                score: sqliteColumn(conceptCodec(TaskScore, ConceptCodecKind.Number, DrizzleDialect.SQLite))('score').notNull(),
                date: sqliteColumn(dateOnlyCodec)('date').notNull(),
                time: sqliteColumn(timeOnlyCodec)('time').notNull(),
                span: sqliteColumn(timeSpanCodec)('span').notNull(),
                details: sqliteColumn(jsonCodec(DrizzleDialect.SQLite, value => {
                    if (!value || typeof value !== 'object' || typeof Reflect.get(value, 'label') !== 'string')
                        throw new Error('Invalid details');
                    return value as { label: string };
                }))('details').notNull()
            });
            connection.run('create table records (id text primary key, concept_id text, name text, score real, date text, time text, span text, details text)');
            const db = drizzle(connection);
            const id = Guid.parse('00112233-4455-6677-8899-aabbccddeeff');
            db.insert(records).values({ id, conceptId: new TaskId(id), name: new TaskName('hello'),
                score: new TaskScore(42), date: DateOnly.parse('2026-03-02'), time: TimeOnly.parse('12:34:56'),
                span: TimeSpan.parse('01:02:03'), details: { label: 'item' } }).run();
            const row = db.select().from(records).get()!;
            row.id.should.be.instanceOf(Guid);
            row.conceptId.should.be.instanceOf(TaskId);
            row.name.should.be.instanceOf(TaskName);
            row.score.should.be.instanceOf(TaskScore);
            row.date.should.be.instanceOf(DateOnly);
            row.time.should.be.instanceOf(TimeOnly);
            row.span.should.be.instanceOf(TimeSpan);
            row.details.should.deep.equal({ label: 'item' });
        } finally { connection.close(); }
    });
});
