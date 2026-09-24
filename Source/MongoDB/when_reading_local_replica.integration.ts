// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, should, it } from 'vitest';
import { shouldRejectWithError } from './shouldRejectWithError.js';
import { MongoClient, ObjectId } from 'mongodb';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import type { ExecutionContext } from '@cratis/arc.core';
import { z } from 'zod';
import { MongoReadModels } from './index.js';

should();

interface Task { _id: ObjectId; title: string; status: string; owner: string }
const context = (tenantId: string, signal = new AbortController().signal): ExecutionContext => ({ tenantId, correlationId: crypto.randomUUID(), principal: undefined, signal, allowedSeverity: 3 });

describe('when reading models from a local MongoDB replica set', () => {
    it('enforces owner and tenant isolation, accurate counts, stable pages and Arc paging', async () => {
        if (!process.env.ARC_MONGO_TEST_URI) throw new Error('ARC_MONGO_TEST_URI is required; this integration test was not run');
        const client = new MongoClient(process.env.ARC_MONGO_TEST_URI, { serverSelectionTimeoutMS: 5000 });
        // Every run owns only these random database names, never a fixed shared integration database.
        const prefix = `arc_mongodb_it_${crypto.randomUUID().replaceAll('-', '')}`;
        const a = client.db(`${prefix}_a`);
        const b = client.db(`${prefix}_b`);
        let connected = false;
        try {
            await client.connect();
            connected = true;
            const firstId = new ObjectId('000000000000000000000001');
            const secondId = new ObjectId('000000000000000000000002');
            const otherOwnerId = new ObjectId('000000000000000000000003');
            const otherTenantId = new ObjectId('000000000000000000000004');
            await a.collection<Task>('tasks').insertMany([
                { _id: secondId, title: 'same', status: 'OPEN', owner: 'alice' },
                { _id: firstId, title: 'same', status: 'open', owner: 'alice' },
                { _id: otherOwnerId, title: 'same', status: 'open', owner: 'bob' }
            ]);
            await b.collection<Task>('tasks').insertOne({ _id: otherTenantId, title: 'other tenant', status: 'open', owner: 'alice' });
            const models = new MongoReadModels<Task, { owner: string; status: string }>({
                client, databaseForTenant: tenant => `${prefix}_${tenant}`,
                filterFor: ({ owner, status }) => ({ owner, status })
            }, 'tasks');
            const input = { owner: 'alice', status: 'open' };
            const collation = { locale: 'en', strength: 2 };
            const found = await models.findById(context('a'), input, firstId);
            should().exist(found);
            found!._id.should.deep.equal(firstId);
            should().equal(await models.findById(context('a'), input, otherOwnerId), null);
            should().equal(await models.findById(context('b'), input, firstId), null);
            await shouldRejectWithError(models.findById(context('a'), input, { $ne: null } as unknown as ObjectId), 'A primitive or BSON ObjectId');
            const first = await models.page(context('a'), input, { page: 0, pageSize: 1 }, { collation, sort: { title: 1 } });
            const second = await models.page(context('a'), input, { page: 1, pageSize: 1 }, { collation, sort: { title: 1 } });
            (first.items.map(item => item._id)).should.deep.equal([firstId]);
            (second.items.map(item => item._id)).should.deep.equal([secondId]);
            (first.paging).should.deep.equal({ page: 0, size: 1, totalItems: 2, totalPages: 2 });
            (second.paging).should.deep.equal({ page: 1, size: 1, totalItems: 2, totalPages: 2 });
            const server = new ArcServer({ queries: [defineQuery({
                name: 'OwnerTasks', schema: z.object({ owner: z.string(), status: z.string() }),
                perform: (parsed, ctx, options) => models.queryPage(ctx, parsed, options, { collation, sort: { title: 1 } })
            })] });
            const result = await server.performQuery('OwnerTasks', input, context('a'), { paging: { page: 1, pageSize: 1 } });
            (result.isSuccess).should.equal(true);
            ((result.data as Task[]).map(item => item._id)).should.deep.equal([secondId]);
            (result.paging).should.deep.equal({ page: 1, size: 1, totalItems: 2, totalPages: 2 });
            const unpaged = await server.performQuery('OwnerTasks', input, context('a'));
            (unpaged.isSuccess).should.equal(false);
            (unpaged.exceptionMessages).should.contain('Error: MongoDB queryPage requires options.paging');
            const aborted = new AbortController();
            aborted.abort();
            await shouldRejectWithError(models.find(context('a', aborted.signal), input));
            await shouldRejectWithError(models.findById(context('a', aborted.signal), input, firstId));
            await shouldRejectWithError(models.page(context('a', aborted.signal), input, { page: 0, pageSize: 1 }));
        } finally {
            try {
                if (connected) {
                    try { await a.dropDatabase(); }
                    finally { await b.dropDatabase(); }
                }
            } finally {
                await client.close();
            }
        }
    }, 30000);
});
