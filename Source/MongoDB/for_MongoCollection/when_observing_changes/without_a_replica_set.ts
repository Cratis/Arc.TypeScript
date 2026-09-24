// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import sinon from 'sinon';
import type { Collection, Db, Document } from 'mongodb';
import { given } from '../../given.js';
import { MongoCollection } from '../../MongoCollection.js';
import { a_replica_set } from '../given/a_replica_set.js';
import { TaskRecord } from '../given/TaskRecord.js';

should();
describe('when observing changes without a replica set', given(a_replica_set, context => {
    let error: unknown;
    const watch = sinon.stub();
    beforeEach(async () => {
        const database = { command: sinon.stub().resolves({ ok: 1 }) } as unknown as Db;
        const collection = new MongoCollection({ watch } as unknown as Collection<Document>, database,
            TaskRecord, context.context('a'));
        try { await collection.observeIterable(); } catch (failure) { error = failure; }
    });
    it('should reject without starting a change stream', () => {
        String(error).should.contain('requires a replica set');
        watch.called.should.equal(false);
    });
}));
