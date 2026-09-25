// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import { Guid } from '@cratis/fundamentals';
import { firstValueFrom, ReplaySubject, skip, take, timeout } from 'rxjs';
import type { Subscription } from 'rxjs';
import { given } from '../../given.js';
import { mongoCollection, mongoDBWatcher } from '../../index.js';
import { TaskRecord } from '../given/TaskRecord.js';
import { RelatedRecord } from '../given/RelatedRecord.js';
import { a_replica_set } from '../given/a_replica_set.js';

should();
describe('when observing joined collections with a replica set', given(a_replica_set, context => {
    let application: ArcApplication;
    beforeEach(async () => {
        if (!process.env.ARC_MONGO_TEST_URI) throw new Error('ARC_MONGO_TEST_URI is required');
        await context.client.connect();
        application = await ArcApplication.createBuilder().withMongoDB({ client: context.client,
            databaseNameResolver: tenant => `${context.name}_${tenant}`, readModels: [TaskRecord, RelatedRecord] }).build();
    });
    afterEach(async () => {
        await application.dispose();
        await context.client.db(`${context.name}_a`).dropDatabase();
        await context.client.db(`${context.name}_b`).dropDatabase();
        await context.client.close();
    });
    it('should emit snapshots after either collection changes without leaking another tenant', async () => {
        const scope = application.server.services.createScope(context.context('a'));
        const other = application.server.services.createScope(context.context('b'));
        let subscription: Subscription | undefined;
        try {
            const primary = await scope.resolve(mongoCollection(TaskRecord));
            const related = await scope.resolve(mongoCollection(RelatedRecord));
            const watcher = await scope.resolve(mongoDBWatcher);
            const source = watcher.observe(primary).join(related).select((tasks, relations) =>
                [tasks.map(task => task.title), relations.map(relation => relation.name)] as [string[], string[]]);
            const updates = new ReplaySubject<[string[], string[]]>(1);
            subscription = source.subscribe(updates);
            (await firstValueFrom(updates.pipe(take(1), timeout(10000)))).should.deep.equal([[], []]);
            const first = firstValueFrom(updates.pipe(skip(1), take(1), timeout(10000)));
            await primary.native.insertOne(primary.codec.serialize(Object.assign(new TaskRecord(), {
                id: Guid.parse('00112233-4455-6677-8899-aabbccddeeff'), title: 'task'
            })));
            (await first)[0].should.deep.equal(['task']);
            const second = firstValueFrom(updates.pipe(skip(1), take(1), timeout(10000)));
            await related.native.insertOne(related.codec.serialize(Object.assign(new RelatedRecord(), { id: 'one', name: 'related' })));
            (await second)[1].should.deep.equal(['related']);
            const otherTask = await other.resolve(mongoCollection(TaskRecord));
            (() => watcher.observe(otherTask)).should.throw('same tenant and scope');
        } finally {
            subscription?.unsubscribe();
            await scope.dispose();
            await other.dispose();
        }
    }, 30000);
}));
