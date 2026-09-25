// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { Timestamp } from 'mongodb';
import type { Collection, Db, Document } from 'mongodb';
import type { ExecutionContext } from '@cratis/arc.core';
import { given } from '../../given.js';
import { MongoCollection } from '../../MongoCollection.js';
import { MongoDBWatcher } from '../../MongoDBWatcher.js';
import { TaskRecord } from '../../for_MongoCollection/given/TaskRecord.js';

should();
class a_failing_watcher {
    readonly error = new Error('stream lost');
    readonly context: ExecutionContext = { tenantId: 'a', signal: new AbortController().signal,
        allowedSeverity: 3, correlationId: 'test', principal: undefined };
    watches = 0;
    readonly database = {
        databaseName: 'tenant',
        command: async () => ({ setName: 'rs0', operationTime: new Timestamp({ t: 1, i: 1 }) }),
        watch: () => {
            this.watches++;
            return { next: async () => { throw this.error; }, close: async () => {} };
        }
    } as unknown as Db;
    readonly collection = new MongoCollection({ collectionName: 'Tasks' } as Collection<Document>, this.database,
        TaskRecord, this.context);
    readonly watcher = new MongoDBWatcher(this.database, this.context);
}
describe('when a stream fails with a nonresumable error', given(a_failing_watcher, context => {
    let failure: unknown;
    beforeEach(async () => {
        try { await firstValueFrom(context.watcher.changes(context.collection)); }
        catch (error) { failure = error; }
    });
    it('should fail subscribers and allow a fresh stream on resubscription', async () => {
        (failure as Error).should.equal(context.error);
        try { await firstValueFrom(context.watcher.changes(context.collection)); }
        catch (error) { (error as Error).should.equal(context.error); }
        context.watches.should.equal(2);
        await context.watcher[Symbol.asyncDispose]();
    });
}));
