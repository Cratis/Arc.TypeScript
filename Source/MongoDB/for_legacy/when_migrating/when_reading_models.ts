// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, should, it, vi } from 'vitest';
import { shouldRejectWithError } from '../../../Arc.Core/for_legacy/shouldRejectWithError.js';
import { MongoClient, ObjectId } from 'mongodb';
import type { ClientSession, Collection, Db, FindOptions } from 'mongodb';
import type { MongoPageFindOptions } from '../../index.js';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import type { ExecutionContext } from '@cratis/arc.core';
import { z } from 'zod';
import { MongoReadModels } from '../../index.js';

should();

interface Task { _id: ObjectId; title: string; status: string; owner: string }
const context = (tenantId?: string, signal = new AbortController().signal): ExecutionContext => ({ tenantId, correlationId: crypto.randomUUID(), principal: undefined, signal, allowedSeverity: 3 });

function fixture(maxPageSize?: number) {
    const client = new MongoClient('mongodb://localhost:27017');
    const doc: Task = { _id: new ObjectId(), title: 'first', status: 'open', owner: 'alice' };
    const toArray = vi.fn(async () => [doc]);
    const limit = vi.fn().mockReturnValue({ toArray });
    const skip = vi.fn().mockReturnValue({ limit });
    const find = vi.fn().mockReturnValue({ toArray, skip });
    const findOne = vi.fn(async () => doc);
    const countDocuments = vi.fn(async () => 3);
    const collection = { find, findOne, countDocuments } as unknown as Collection<Task>;
    const db = vi.spyOn(client, 'db').mockReturnValue({ collection: () => collection } as unknown as Db);
    const filterFor = vi.fn((owner: string) => ({ owner }));
    const models = new MongoReadModels<Task, string>({ client, maxPageSize, databaseForTenant: tenant => `app_${tenant}`, filterFor }, 'tasks');
    return { client, doc, models, db, filterFor, find, findOne, countDocuments, skip, limit, toArray };
}

describe('when reading MongoDB models', () => {
    it('rejects tenant and database resolution failures through promises for every method', async () => {
        const { client, models } = fixture();
        await shouldRejectWithError(models.find(context(), 'alice'), 'A tenant is required');
        await shouldRejectWithError(models.findById(context(), 'alice', new ObjectId()), 'A tenant is required');
        await shouldRejectWithError(models.page(context(), 'alice', { page: 0, pageSize: 1 }), 'A tenant is required');
        await shouldRejectWithError(models.queryPage(context(), 'alice', { paging: { page: 0, pageSize: 1 } }), 'A tenant is required');
        const invalid = new MongoReadModels<Task, string>({ client, databaseForTenant: () => '', filterFor: owner => ({ owner }) }, 'tasks');
        await shouldRejectWithError(invalid.find(context('a'), 'alice'), 'no database');
    });

    it('combines the trusted filter with a safe id and forwards the authoritative context signal', async () => {
        const { doc, models, findOne, filterFor } = fixture();
        const ctx = context('a');
        const found = await models.findById(ctx, 'alice', doc._id);
        should().exist(found);
        (found as Task).should.deep.equal(doc);
        filterFor.mock.calls.should.deep.include(['alice', ctx]);
        findOne.mock.calls.should.deep.include([{ $and: [{ owner: 'alice' }, { _id: doc._id }] }, { signal: ctx.signal }]);
        await shouldRejectWithError(models.findById(ctx, 'alice', { $ne: null } as unknown as ObjectId), 'A primitive or BSON ObjectId');
        await shouldRejectWithError(models.findById(ctx, 'alice', { value: 'id' } as unknown as ObjectId), 'A primitive or BSON ObjectId');
        findOne.mock.calls.should.have.lengthOf(1);
    });

    it('forwards find signal even when caller options specify another signal', async () => {
        const { models, find } = fixture();
        const ctx = context('a');
        await models.find(ctx, 'alice', { signal: new AbortController().signal } as FindOptions<Task>);
        find.mock.calls.should.deep.include([{ owner: 'alice' }, { signal: ctx.signal }]);
    });

    it('counts with the same query semantics without applying paging to the count', async () => {
        const { doc, models, db, find, countDocuments, skip, limit } = fixture();
        const ctx = context('a');
        const session = {} as ClientSession;
        const options = { collation: { locale: 'en', strength: 2 }, hint: 'owner_1', session, readPreference: 'secondary' as const,
            readConcern: { level: 'majority' as const }, maxTimeMS: 1000, comment: 'query', signal: new AbortController().signal };
        const page = await models.page(ctx, 'alice', { page: 1, pageSize: 1 }, options);
        db.mock.calls.should.deep.include(['app_a']);
        countDocuments.mock.calls.should.deep.include([{ owner: 'alice' }, {
            collation: options.collation, hint: options.hint, session, readPreference: options.readPreference,
            readConcern: options.readConcern, maxTimeMS: 1000, comment: 'query', signal: ctx.signal
        }]);
        find.mock.calls.should.deep.include([{ owner: 'alice' }, { ...options, sort: { _id: 1 }, signal: ctx.signal }]);
        skip.mock.calls.should.deep.include([1]);
        limit.mock.calls.should.deep.include([1]);
        (page).should.deep.equal({ items: [doc], paging: { page: 1, size: 1, totalItems: 3, totalPages: 3 } });
    });

    it('appends an id tie-break and rejects unsupported sort forms', async () => {
        const { models, find, db } = fixture();
        await models.page(context('a'), 'alice', { page: 0, pageSize: 1 }, { sort: { status: -1 } });
        find.mock.calls.should.have.lengthOf(1);
        should().exist((find.mock.calls[0] as unknown as [unknown, { sort: unknown }])[0]);
        ((find.mock.calls[0] as unknown as [unknown, { sort: unknown }])[0] as object).should.deep.equal({ owner: 'alice' });
        should().exist((find.mock.calls[0] as unknown as [unknown, { sort: unknown }])[1].sort);
        ((find.mock.calls[0] as unknown as [unknown, { sort: unknown }])[1].sort as object).should.deep.equal({ status: -1, _id: 1 });
        await shouldRejectWithError(models.page(context('a'), 'alice', { page: 0, pageSize: 1 }, { sort: 'status' } as unknown as MongoPageFindOptions<Task>), 'Paged MongoDB sort');
        db.mock.calls.should.have.lengthOf(1);
    });

    it('requires Arc paging and rejects Arc sorting instead of manufacturing a page', async () => {
        const { models, db } = fixture();
        await shouldRejectWithError(models.queryPage(context('a'), 'alice', {}), 'requires options.paging');
        await shouldRejectWithError(models.queryPage(context('a'), 'alice', { paging: { page: 0, pageSize: 1 }, sorting: { field: 'title', direction: 'asc' } }), 'Arc sorting is not supported');
        db.mock.calls.should.have.lengthOf(0);
    });

    it('returns an Arc page from the actual perform input, context and paging options', async () => {
        const { doc, models, skip, limit } = fixture();
        const server = new ArcServer({ queries: [defineQuery({ name: 'OwnerTasks', schema: z.object({ owner: z.string() }), perform: (input, ctx, options) =>
            models.queryPage(ctx, input.owner, options) })] });
        const result = await server.performQuery('OwnerTasks', { owner: 'alice' }, context('a'), { paging: { page: 1, pageSize: 1 } });
        should().exist(result.data);
        (result.data as object).should.deep.equal([doc]);
        (result.paging).should.deep.equal({ page: 1, size: 1, totalItems: 3, totalPages: 3 });
        skip.mock.calls.should.deep.include([1]);
        limit.mock.calls.should.deep.include([1]);
        const unpaged = await server.performQuery('OwnerTasks', { owner: 'alice' }, context('a'));
        (unpaged.isSuccess).should.equal(false);
        (unpaged.exceptionMessages).should.contain('Error: MongoDB queryPage requires options.paging');
    });

    it('rejects unsafe, oversized, and unconfigured page sizes before querying', async () => {
        const { models, db, client } = fixture();
        await shouldRejectWithError(models.page(context('a'), 'alice', { page: 0, pageSize: 0 }), 'Paging requires');
        await shouldRejectWithError(models.page(context('a'), 'alice', { page: 0, pageSize: 101 }), 'maxPageSize');
        db.mock.calls.should.have.lengthOf(0);
        const configured = new MongoReadModels<Task, string>({ client, maxPageSize: 200, databaseForTenant: () => 'app', filterFor: owner => ({ owner }) }, 'tasks');
        await configured.page(context('a'), 'alice', { page: 0, pageSize: 101 });
        (() => new MongoReadModels<Task, string>({ client, maxPageSize: 0, databaseForTenant: () => 'app', filterFor: owner => ({ owner }) }, 'tasks')).should.throw('maxPageSize');
    });
});
