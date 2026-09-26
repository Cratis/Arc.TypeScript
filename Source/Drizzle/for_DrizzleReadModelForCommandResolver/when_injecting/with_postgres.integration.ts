// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, command, commandReadModel, inject, key, Severity } from '@cratis/arc.core';
import { ConceptAs, field, Guid } from '@cratis/fundamentals';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, it, should } from 'vitest';
import { conceptCodec, guidCodec } from '../../ColumnCodec.js';
import { pgColumn } from '../../columns.js';
import { ConceptCodecKind } from '../../ConceptCodecKind.js';
import { DrizzleDialect } from '../../DrizzleDialect.js';
import '../../index.js';

should();
class TaskName extends ConceptAs<string> { static readonly valueType = String; }
class GuidTask {
    @field(Guid) id!: Guid;
    @field(String) title!: string;
}
class NamedTask {
    @field(TaskName) name!: TaskName;
    @field(String) title!: string;
}
const guidTasks = pgTable('guid_tasks', {
    id: pgColumn(guidCodec(DrizzleDialect.PostgreSQL))('id').primaryKey(),
    title: text('title').notNull()
});
const namedTasks = pgTable('named_tasks', {
    name: pgColumn(conceptCodec(TaskName, ConceptCodecKind.String, DrizzleDialect.PostgreSQL))('name').primaryKey(),
    title: text('title').notNull()
});

@command()
class LookUpGuidTask {
    @field(Guid) @key() id!: Guid;
    @inject(commandReadModel(GuidTask))
    handle(task: GuidTask): string { return task.title; }
}
@command()
class LookUpNamedTask {
    @field(TaskName) @key() name!: TaskName;
    @inject(commandReadModel(NamedTask))
    handle(task: NamedTask): string { return task.title; }
}
@command()
class LookUpOptionalTask {
    @field(Guid) @key() id!: Guid;
    @inject(commandReadModel(GuidTask, { optional: true }))
    handle(task: GuidTask | null): string { return task?.title ?? 'not found'; }
}

const id = Guid.parse('00112233-4455-6677-8899-aabbccddeeff');
const missingId = Guid.parse('11112233-4455-6677-8899-aabbccddeeff');
const identity = (tenantId: string) => ({ tenantId, principal: undefined, allowedSeverity: Severity.Warning,
    signal: new AbortController().signal, correlationId: crypto.randomUUID() });

describe('when injecting a PostgreSQL read model into a command', () => {
    let admin: Pool;
    let firstPool: Pool;
    let secondPool: Pool;
    let application: ArcApplication;
    beforeAll(async () => {
        const uri = process.env.ARC_POSTGRES_TEST_URI;
        if (!uri) throw new Error('ARC_POSTGRES_TEST_URI is required');
        admin = new Pool({ connectionString: uri });
        await admin.query('create schema arc_command_a');
        await admin.query('create schema arc_command_b');
        firstPool = new Pool({ connectionString: uri, options: '-c search_path=arc_command_a' });
        secondPool = new Pool({ connectionString: uri, options: '-c search_path=arc_command_b' });
        for (const pool of [firstPool, secondPool]) {
            await pool.query('create table guid_tasks (id uuid primary key, title text not null)');
            await pool.query('create table named_tasks (name text primary key, title text not null)');
        }
        const first = drizzle(firstPool);
        const second = drizzle(secondPool);
        await first.insert(guidTasks).values({ id, title: 'tenant a' });
        await second.insert(guidTasks).values([{ id, title: 'tenant b' }, { id: missingId, title: 'only tenant b' }]);
        await first.insert(namedTasks).values({ name: new TaskName('same-name'), title: 'named a' });
        await second.insert(namedTasks).values({ name: new TaskName('same-name'), title: 'named b' });
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.PostgreSQL,
            databaseFactory: tenant => tenant === 'a' ? first : second,
            readModels: [{ type: GuidTask, table: guidTasks }, { type: NamedTask, table: namedTasks }] });
        builder.add(LookUpGuidTask, LookUpNamedTask, LookUpOptionalTask);
        application = await builder.build();
    });
    afterAll(async () => {
        try {
            if (application) await application.dispose();
            await Promise.all([firstPool?.end(), secondPool?.end()]);
        } finally {
            try {
                if (admin) {
                    await admin.query('drop schema if exists arc_command_a cascade');
                    await admin.query('drop schema if exists arc_command_b cascade');
                }
            } finally { if (admin) await admin.end(); }
        }
    });

    it('should bind a typed GUID key and return the current tenant row', async () => {
        const result = await application.server.executeCommand('LookUpGuidTask', { id: id.toString() }, identity('b'));
        result.isSuccess.should.equal(true);
        (result.response as string).should.equal('tenant b');
    });
    it('should bind a concept key and return the current tenant row', async () => {
        const result = await application.server.executeCommand('LookUpNamedTask', { name: 'same-name' }, identity('a'));
        result.isSuccess.should.equal(true);
        (result.response as string).should.equal('named a');
    });
    it('should not read a GUID row belonging only to another tenant', async () => {
        const other = await application.server.executeCommand('LookUpGuidTask', { id: missingId.toString() }, identity('b'));
        other.isSuccess.should.equal(true);
        (other.response as string).should.equal('only tenant b');
        const result = await application.server.executeCommand('LookUpGuidTask', { id: missingId.toString() }, identity('a'));
        result.isSuccess.should.equal(false);
        result.validationResults[0]!.message.should.equal('GuidTask was not found for the command key');
        result.hasExceptions.should.equal(false);
    });
    it('should reject a missing required concept row with the usual validation result', async () => {
        const result = await application.server.executeCommand('LookUpNamedTask', { name: 'missing' }, identity('b'));
        result.isSuccess.should.equal(false);
        result.validationResults[0]!.message.should.equal('NamedTask was not found for the command key');
        result.hasExceptions.should.equal(false);
    });
    it('should pass null for a missing optional row', async () => {
        const result = await application.server.executeCommand('LookUpOptionalTask', { id: missingId.toString() }, identity('a'));
        result.isSuccess.should.equal(true);
        (result.response as string).should.equal('not found');
    });
    it('should reject a table-level composite primary key at registration', () => {
        const composite = pgTable('composite_tasks', { id: text('id'), locale: text('locale'), title: text('title') },
            table => [primaryKey({ columns: [table.id, table.locale] })]);
        const builder = ArcApplication.createBuilder();
        (() => builder.withDrizzle({ dialect: DrizzleDialect.PostgreSQL, database: drizzle(firstPool),
            readModels: [{ type: GuidTask, table: composite }] }))
            .should.throw('A Drizzle read model requires a primary key for stable paging');
    });
});
