// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { pgSchema, pgTable, text } from 'drizzle-orm/pg-core';
import { sqliteTable, text as sqliteText } from 'drizzle-orm/sqlite-core';
import { postgresqlChangeTrigger } from '../../postgresqlChangeTrigger.js';

const table = pgTable('task".details', { id: text('id').primaryKey() });
const declared = pgSchema('owned').table('tasks', { id: text('id').primaryKey() });

describe('when generating an experimental PostgreSQL change trigger migration', () => {
    let result: string;
    beforeEach(() => { result = postgresqlChangeTrigger(table, { schema: 'tenant".one' }); });
    it('should quote schema and table independently', () => result.should.include('ON "tenant"".one"."task"".details"'));
    it('should use a fixed channel and versioned function', () => {
        result.should.include('"arc_changes_v1" AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE');
        result.should.include("format('%I.%I', TG_TABLE_SCHEMA, TG_TABLE_NAME)");
        result.should.include("('arc_changes')");
        result.should.include('SECURITY INVOKER SET search_path = pg_catalog');
    });
    it('should produce identical SQL for the same table and schema', () => result.should.equal(postgresqlChangeTrigger(table, { schema: 'tenant".one' })));
    it('should require an explicit schema on a schema-less table', () =>
        (() => postgresqlChangeTrigger(table)).should.throw('requires an explicit migration schema'));
    it('should reject a conflicting declared schema', () =>
        (() => postgresqlChangeTrigger(declared, { schema: 'other' })).should.throw('conflicts'));
    it('should reject other dialects', () =>
        (() => postgresqlChangeTrigger(sqliteTable('tasks', { id: sqliteText('id').primaryKey() }))).should.throw());
    it('should reject NUL and overlength identifiers', () => {
        (() => postgresqlChangeTrigger(table, { schema: 'a\0b' })).should.throw();
        (() => postgresqlChangeTrigger(table, { schema: 'a'.repeat(64) })).should.throw();
    });
});
