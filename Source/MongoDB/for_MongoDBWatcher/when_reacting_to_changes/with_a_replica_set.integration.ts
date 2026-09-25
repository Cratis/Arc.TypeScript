// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import { Guid } from '@cratis/fundamentals';
import { firstValueFrom, take, timeout } from 'rxjs';
import { given } from '../../given.js';
import { mongoCollection, mongoDBWatcher } from '../../index.js';
import { TaskRecord } from '../../for_MongoCollection/given/TaskRecord.js';
import { a_replica_set } from '../../for_MongoCollection/given/a_replica_set.js';

should();
describe('when reacting to changes with a replica set', given(a_replica_set, context => {
    let application: ArcApplication;
    beforeEach(async () => {
        if (!process.env.ARC_MONGO_TEST_URI) throw new Error('ARC_MONGO_TEST_URI is required');
        await context.client.connect();
        application = await ArcApplication.createBuilder().withMongoDB({ client: context.client,
            databaseNameResolver: tenant => `${context.name}_${tenant}`, readModels: [TaskRecord] }).build();
    });
    afterEach(async () => {
        await application.dispose();
        await context.client.db(`${context.name}_a`).dropDatabase();
        await context.client.close();
    });
    it('should deliver the inserted collection change and close with the scope', async () => {
        const scope = application.server.services.createScope(context.context('a'));
        try {
            const collection = await scope.resolve(mongoCollection(TaskRecord));
            const watcher = await scope.resolve(mongoDBWatcher);
            const change = firstValueFrom(watcher.changes(collection).pipe(take(1), timeout(10000)));
            // The watcher opens lazily: wait for its initial snapshot before writing.
            const ready = firstValueFrom(watcher.observe(collection).join(collection).select((items) => items)
                .pipe(take(1), timeout(10000)));
            await ready;
            await collection.native.insertOne(collection.codec.serialize(Object.assign(new TaskRecord(), {
                id: Guid.parse('00112233-4455-6677-8899-aabbccddeeff'), title: 'task'
            })));
            (await change).operationType.should.equal('insert');
        } finally { await scope.dispose(); }
    }, 30000);
}));
