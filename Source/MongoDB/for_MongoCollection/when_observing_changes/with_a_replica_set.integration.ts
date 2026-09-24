// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import { Guid } from '@cratis/fundamentals';
import type { Document, Filter } from 'mongodb';
import { given } from '../../given.js';
import { mongoCollection } from '../../index.js';
import { TaskRecord } from '../given/TaskRecord.js';
import { TaskQueries } from '../given/TaskQueries.js';
import { a_replica_set } from '../given/a_replica_set.js';

should();
describe('when observing changes with a replica set', given(a_replica_set, context => {
    let application: ArcApplication;
    const id = Guid.parse('00112233-4455-6677-8899-aabbccddeeff');
    const document = Object.assign(new TaskRecord(), { id, title: 'first' });
    beforeEach(async () => {
        if (!process.env.ARC_MONGO_TEST_URI) throw new Error('ARC_MONGO_TEST_URI is required');
        await context.client.connect();
        const builder = ArcApplication.createBuilder();
        builder.add(TaskQueries).addMongoDB({ client: context.client, databaseNameResolver: tenant => `${context.name}_${tenant}`,
            readModels: [TaskRecord] });
        application = await builder.build();
    });
    afterEach(async () => {
        try { await application.dispose(); }
        finally {
            try { await context.client.db(`${context.name}_a`).dropDatabase(); }
            finally {
                try { await context.client.db(`${context.name}_b`).dropDatabase(); }
                finally { await context.client.close(); }
            }
        }
    });
    it('should deliver an initial snapshot, inserts and deletions without crossing tenants', async () => {
        const tenant = context.context('a');
        const other = context.context('b');
        const scope = application.server.services.createScope(tenant);
        try {
            const collection = await scope.resolve(mongoCollection(TaskRecord));
            collection.codec.fieldName('id').should.equal('_id');
            const session = await application.server.openObservableQuery('TaskQueries.changes', {}, tenant);
            try {
                ((await session.current())!.data as unknown[]).should.deep.equal([]);
                const iterator = session.results();
                (await iterator.next()).value!.data.should.deep.equal([]);
                await collection.native.insertOne(collection.codec.serialize(document));
                const inserted = await iterator.next();
                (inserted.value!.data as { id: string }[])[0]!.id.should.equal(id.toString());
                const isolated = await application.server.performQuery('TaskQueries.all', {}, other);
                (isolated.data as unknown[]).length.should.equal(0);
                await collection.native.deleteOne({ _id: collection.codec.id(id) } as Filter<Document>);
                (await iterator.next()).value!.data.should.deep.equal([]);
                await iterator.return(undefined);
            } finally { await session.close(); }
        } finally { await scope.dispose(); }
    }, 30000);
    it('should observe one document by id, including deletion, and close its stream on scope disposal', async () => {
        const tenant = context.context('a');
        const scope = application.server.services.createScope(tenant);
        const collection = await scope.resolve(mongoCollection(TaskRecord));
        try {
            const observation = await collection.observeByIdIterable(id);
            const iterator = observation[Symbol.asyncIterator]();
            should().equal((await iterator.next()).value, null);
            await collection.native.insertOne(collection.codec.serialize(document));
            (await iterator.next()).value!.title.should.equal('first');
            await collection.native.deleteOne({ _id: collection.codec.id(id) } as Filter<Document>);
            should().equal((await iterator.next()).value, null);
            await scope.dispose();
            ((await iterator.next()).done ?? false).should.equal(true);
        } finally { await scope.dispose(); }
    }, 30000);
    it('should honor application default sorting when Arc has not requested a sort', async () => {
        const tenant = context.context('a');
        const scope = application.server.services.createScope(tenant);
        try {
            const collection = await scope.resolve(mongoCollection(TaskRecord));
            await collection.native.insertMany([
                collection.codec.serialize(Object.assign(new TaskRecord(), { id, title: 'z' })),
                collection.codec.serialize(Object.assign(new TaskRecord(), {
                    id: Guid.parse('11112233-4455-6677-8899-aabbccddeeff'), title: 'a'
                }))
            ]);
            const page = await collection.queryPage({}, { paging: { page: 0, pageSize: 1 } }, { sort: { title: 1 } });
            page.items[0]!.title.should.equal('a');
        } finally { await scope.dispose(); }
    });
    it('should push Arc sorting and paging into MongoDB with a total count', async () => {
        const tenant = context.context('a');
        const scope = application.server.services.createScope(tenant);
        try {
            const collection = await scope.resolve(mongoCollection(TaskRecord));
            await collection.native.insertMany([
                collection.codec.serialize(Object.assign(new TaskRecord(), { id, title: 'z' })),
                collection.codec.serialize(Object.assign(new TaskRecord(), {
                    id: Guid.parse('11112233-4455-6677-8899-aabbccddeeff'), title: 'a'
                }))
            ]);
            const page = await application.server.performQuery('TaskQueries.page', {}, tenant,
                { paging: { page: 0, pageSize: 1 }, sorting: { field: 'title', direction: 'asc' } });
            page.isSuccess.should.equal(true);
            page.paging!.totalItems.should.equal(2);
            (page.data as { title: string }[])[0]!.title.should.equal('a');
        } finally { await scope.dispose(); }
    });
}));
