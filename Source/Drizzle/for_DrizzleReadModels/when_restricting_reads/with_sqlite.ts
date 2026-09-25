// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { eq } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { field, Guid } from '@cratis/fundamentals';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { given } from '../../given.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';
import { TaskRecord } from '../given/TaskRecord.js';

should();
const shouldRejectWithMessage = async (promise: Promise<unknown>, message: string): Promise<void> => {
    const error = await promise.then(() => null, reason => reason as Error);
    should().exist(error);
    error!.message.should.contain(message);
};
class TitleOnly { @field(String) title!: string; }
describe('when restricting read-only SQL access', given(a_sqlite_database, context => {
    beforeEach(() => context.establish());
    afterEach(() => context.close());
    it('should reject an undeclared column for sorting without selecting it', async () => {
        const hidden = sqliteTable('hidden', {
            id: text('id').primaryKey(), title: text('title'), secret: text('secret')
        });
        context.native.run('create table hidden (id text primary key, title text, secret text)');
        context.native.run("insert into hidden values ('00112233-4455-6677-8899-aabbccddeeff', 'a', 'private')");
        const models = new DrizzleReadModels(context.database, hidden, TaskRecord);
        await shouldRejectWithMessage(models.queryPage(undefined, { paging: { page: 0, pageSize: 1 },
            sorting: { field: 'secret', direction: 'asc' } }), 'Unknown Drizzle model field: secret');
        const row = await models.findOne(undefined);
        row!.title.should.equal('a');
        Object.hasOwn(row!, 'secret').should.equal(false);
    });
    it('should not expose an undeclared primary key as a client sort field', async () => {
        const models = new DrizzleReadModels(context.database, context.table, TitleOnly);
        await shouldRejectWithMessage(models.queryPage(undefined, { paging: { page: 0, pageSize: 1 },
            sorting: { field: 'id', direction: 'asc' } }), 'Unknown Drizzle model field: id');
        (await models.findOne(undefined))!.title.should.equal('z');
    });
    it('should cap unpaged reads and reject invalid pages', async () => {
        const models = new DrizzleReadModels(context.database, context.table, TaskRecord, 1);
        await shouldRejectWithMessage(models.find(undefined), 'The result exceeds the maximum of 1 items; use queryPage for paged results');
        (await models.findOne(eq(context.table.title, 'a')))!.title.should.equal('a');
        should().equal(await models.findOne(eq(context.table.title, 'missing')), undefined);
        await shouldRejectWithMessage(models.queryPage(undefined, { paging: { page: -1, pageSize: 1 } }), 'Invalid Drizzle page');
        await shouldRejectWithMessage(models.queryPage(undefined, { paging: { page: 0, pageSize: 2 } }), 'maximum page size of 1');
        await shouldRejectWithMessage(models.queryPage(undefined, { paging: { page: Number.MAX_SAFE_INTEGER, pageSize: 2 } }),
            'Invalid Drizzle page');
        (() => new DrizzleReadModels(context.database, context.table, TaskRecord, 10001)).should.throw('maxPageSize');
    });
    it('should allow a bounded unpaged query', async () => {
        const models = new DrizzleReadModels(context.database, context.table, TaskRecord, 2);
        (await models.queryPage(undefined, {})).items.should.have.lengthOf(2);
    });
    it('should order descending with a primary-key tie-breaker', async () => {
        const id = Guid.parse('22112233-4455-6677-8899-aabbccddeeff');
        context.database.insert(context.table).values({ id, title: 'a' }).run();
        const models = new DrizzleReadModels(context.database, context.table, TaskRecord);
        const sorting = { field: 'title', direction: 'desc' } as const;
        const items = await models.find(undefined, sorting);
        items.map(item => item.title).should.deep.equal(['z', 'a', 'a']);
        items.slice(1).map(item => item.id.toString()).should.deep.equal([
            '11112233-4455-6677-8899-aabbccddeeff', id.toString()
        ]);
    });
    it('should require a primary key and all Arc fields', () => {
        const noKey = sqliteTable('no_key', { id: text('id'), title: text('title') });
        (() => new DrizzleReadModels(context.database, noKey, TaskRecord)).should.throw('requires a primary key');
    });
}));
