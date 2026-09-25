// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, command, commandReadModel, inject, InvalidQuerySort, key, QueryPagingRequired,
    Severity, SortDirection } from '@cratis/arc.core';
import { ConceptAs, DateOnly, field, Guid, TimeOnly } from '@cratis/fundamentals';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import { mysqlTable, text } from 'drizzle-orm/mysql-core';
import { createPool, type Pool } from 'mysql2/promise';
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { conceptCodec, dateOnlyCodec, guidCodec, jsonCodec, timeOnlyCodec } from '../../ColumnCodec.js';
import { mysqlColumn } from '../../columns.js';
import { ConceptCodecKind } from '../../ConceptCodecKind.js';
import { DrizzleDialect } from '../../DrizzleDialect.js';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { drizzleReadModel } from '../../index.js';

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
const table = mysqlTable('tasks', {
    id: mysqlColumn(guidCodec(DrizzleDialect.MySQL))('id').primaryKey(),
    title: text('title').notNull(),
    name: mysqlColumn(conceptCodec(TaskName, ConceptCodecKind.String, DrizzleDialect.MySQL, 120))('name').notNull(),
    date: mysqlColumn(dateOnlyCodec)('date').notNull(),
    time: mysqlColumn(timeOnlyCodec)('time').notNull(),
    details: mysqlColumn(jsonCodec(DrizzleDialect.MySQL, value => {
        if (!value || typeof value !== 'object' || typeof Reflect.get(value, 'label') !== 'string')
            throw new Error('Invalid details');
        return value as { label: string };
    }))('details').notNull()
});

@command()
class LookUpTask {
    @field(Guid) @key() id!: Guid;
    @inject(commandReadModel(RichRecord))
    handle(task: RichRecord): string { return task.title; }
}

const firstId = Guid.parse('00112233-4455-6677-8899-aabbccddeeff');
const secondId = Guid.parse('11112233-4455-6677-8899-aabbccddeeff');
const thirdId = Guid.parse('22112233-4455-6677-8899-aabbccddeeff');

/** Live MySQL 8.4 fixture with two physically separate tenant databases. */
describe('when reading MySQL', () => {
    let firstPool: Pool;
    let secondPool: Pool;
    async function establish() {
        if (!process.env.ARC_MYSQL_TEST_URI) throw new Error('ARC_MYSQL_TEST_URI is required');
        const uri = process.env.ARC_MYSQL_TEST_URI;
        firstPool = createPool({ uri, dateStrings: true });
        await firstPool.query('create database if not exists arc_other');
        secondPool = createPool({ uri: uri.replace(/\/arc_test$/, '/arc_other'), dateStrings: true });
        const schema = `create table tasks (id char(36) primary key, title text not null, name varchar(120) not null,
            date date not null, time time not null, details json not null)`;
        await firstPool.query(schema);
        await secondPool.query(schema);
    }
    async function close() {
        try {
            await firstPool.query('drop table tasks');
            await secondPool.query('drop table tasks');
        } finally {
            await firstPool.end();
            await secondPool.end();
        }
    }
    beforeEach(async () => { await establish(); });
    afterEach(async () => { await close(); });

    async function seed() {
        const db = drizzle(firstPool);
        await db.insert(table).values([
            { id: firstId, title: 'z', name: new TaskName('first'), date: DateOnly.parse('2026-03-02'),
                time: TimeOnly.parse('12:34:56'), details: { label: 'one' } },
            { id: secondId, title: 'a', name: new TaskName('second'), date: DateOnly.parse('2026-03-03'),
                time: TimeOnly.parse('13:34:56'), details: { label: 'two' } },
            { id: thirdId, title: 'a', name: new TaskName('third'), date: DateOnly.parse('2026-03-04'),
                time: TimeOnly.parse('14:34:56'), details: { label: 'three' } }
        ]);
        return db;
    }

    it('should decode GUID, concept, JSON, date and time columns with stable count, page and sort', async () => {
        const db = await seed();
        const models = new DrizzleReadModels(db, table, RichRecord);
        const first = await models.queryPage(undefined, { paging: { page: 0, pageSize: 1 },
            sorting: { field: 'title', direction: SortDirection.Ascending } });
        const second = await models.queryPage(undefined, { paging: { page: 1, pageSize: 1 },
            sorting: { field: 'title', direction: SortDirection.Ascending } });
        first.totalItems.should.equal(3);
        first.items[0]!.id.toString().should.equal(secondId.toString());
        second.items[0]!.id.toString().should.equal(thirdId.toString());
        first.items[0]!.id.should.be.instanceOf(Guid);
        first.items[0]!.name.should.be.instanceOf(TaskName);
        first.items[0]!.name.value.should.equal('second');
        first.items[0]!.date.toString().should.equal('2026-03-03');
        first.items[0]!.time.toString().should.equal('13:34:56');
        first.items[0]!.details.should.deep.equal({ label: 'two' });
        const descending = await models.queryPage(undefined, { paging: { page: 0, pageSize: 1 },
            sorting: { field: 'title', direction: SortDirection.Descending } });
        descending.items[0]!.id.toString().should.equal(firstId.toString());
    });

    it('should route reads to the current tenant database with databaseFactory', async () => {
        const first = drizzle(firstPool);
        const second = drizzle(secondPool);
        await first.insert(table).values({ id: firstId, title: 'tenant a', name: new TaskName('first'),
            date: DateOnly.parse('2026-03-02'), time: TimeOnly.parse('12:34:56'), details: { label: 'one' } });
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.MySQL, databaseFactory: tenant => tenant === 'a' ? first : second,
            readModels: [{ type: RichRecord, table }] });
        const app = await builder.build();
        const identity = (tenantId: string) => ({ tenantId, principal: undefined, allowedSeverity: Severity.Warning,
            signal: new AbortController().signal, correlationId: crypto.randomUUID() });
        const a = app.server.services.createScope(identity('a'));
        const b = app.server.services.createScope(identity('b'));
        try {
            (await (await a.resolve(drizzleReadModel(RichRecord))).queryPage(undefined, { paging: { page: 0, pageSize: 1 } }))
                .totalItems.should.equal(1);
            (await (await b.resolve(drizzleReadModel(RichRecord))).queryPage(undefined, { paging: { page: 0, pageSize: 1 } }))
                .totalItems.should.equal(0);
        } finally { await a.dispose(); await b.dispose(); await app.dispose(); }
    });

    it('should reject invalid sort fields and require paging past the limit', async () => {
        const db = await seed();
        const models = new DrizzleReadModels(db, table, RichRecord, 2);
        const invalidSort = await models.queryPage(undefined, { paging: { page: 0, pageSize: 1 },
            sorting: { field: 'missing', direction: SortDirection.Ascending } }).catch(error => error as Error);
        invalidSort.should.be.instanceOf(InvalidQuerySort);
        const unpaged = await models.find(undefined).catch(error => error as Error);
        unpaged.should.be.instanceOf(QueryPagingRequired);
        const oversized = await models.queryPage(undefined, { paging: { page: 0, pageSize: 3 } }).catch(error => error as Error);
        oversized.should.be.instanceOf(QueryPagingRequired);
        const implicit = await models.queryPage(undefined, {}).catch(error => error as Error);
        implicit.should.be.instanceOf(QueryPagingRequired);
        (await models.find(eq(table.title, 'z'))).should.have.lengthOf(1);
    });

    it('should resolve a command read model by GUID key in the tenant and reject a missing key', async () => {
        const first = drizzle(firstPool);
        const second = drizzle(secondPool);
        await second.insert(table).values({ id: firstId, title: 'tenant b', name: new TaskName('second'),
            date: DateOnly.parse('2026-03-03'), time: TimeOnly.parse('13:34:56'), details: { label: 'two' } });
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.MySQL, databaseFactory: tenant => tenant === 'a' ? first : second,
            readModels: [{ type: RichRecord, table }] });
        builder.add(LookUpTask);
        const app = await builder.build();
        const identity = (tenantId: string) => ({ tenantId, principal: undefined, allowedSeverity: Severity.Warning,
            signal: new AbortController().signal, correlationId: crypto.randomUUID() });
        try {
            const found = await app.server.executeCommand('LookUpTask', { id: firstId.toString() }, identity('b'));
            found.isSuccess.should.equal(true);
            (found.response as string).should.equal('tenant b');
            const missing = await app.server.executeCommand('LookUpTask', { id: firstId.toString() }, identity('a'));
            missing.isSuccess.should.equal(false);
        } finally { await app.dispose(); }
    });
});
