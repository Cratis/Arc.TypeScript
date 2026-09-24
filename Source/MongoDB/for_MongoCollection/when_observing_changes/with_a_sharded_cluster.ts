// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import sinon from 'sinon';
import { Timestamp } from 'mongodb';
import type { Collection, Db, Document } from 'mongodb';
import { given } from '../../given.js';
import { MongoCollection } from '../../MongoCollection.js';
import { a_replica_set } from '../given/a_replica_set.js';
import { TaskRecord } from '../given/TaskRecord.js';

should();
describe('when observing a sharded cluster', given(a_replica_set, context => {
    it('should use an operation time and accept a mongos hello', async () => {
        const stream = { close: sinon.stub().resolves() };
        const watch = sinon.stub().returns(stream);
        const native = { watch, find: sinon.stub().returns({ limit: () => ({ toArray: async () => [] }) }) };
        const database = { command: sinon.stub().resolves({ msg: 'isdbgrid', operationTime: new Timestamp({ t: 1, i: 1 }) }) };
        const collection = new MongoCollection(native as unknown as Collection<Document>, database as unknown as Db,
            TaskRecord, context.context('a'));
        const observation = await collection.observe();
        watch.firstCall.args[1].startAtOperationTime.should.be.instanceOf(Timestamp);
        await observation.close();
    });
}));
