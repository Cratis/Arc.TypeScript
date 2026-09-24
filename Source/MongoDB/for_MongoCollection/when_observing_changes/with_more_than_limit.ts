// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import sinon from 'sinon';
import { Timestamp } from 'mongodb';
import type { ChangeStream, Collection, Db, Document } from 'mongodb';
import { given } from '../../given.js';
import { MongoCollection } from '../../MongoCollection.js';
import { a_replica_set } from '../given/a_replica_set.js';
import { TaskRecord } from '../given/TaskRecord.js';

should();
describe('when observing changes with more than the configured limit', given(a_replica_set, context => {
    let error: unknown;
    const close = sinon.stub().resolves();
    beforeEach(async () => {
        const stream = { tryNext: sinon.stub().resolves(null), close } as unknown as ChangeStream<Document>;
        const limit = sinon.stub().returns({ toArray: sinon.stub().resolves([{}, {}]) });
        const native = { watch: sinon.stub().returns(stream), find: sinon.stub().returns({ limit }) } as unknown as Collection<Document>;
        const database = { command: sinon.stub().resolves({ setName: 'rs0', operationTime: new Timestamp({ t: 1, i: 1 }) }) } as unknown as Db;
        const collection = new MongoCollection(native, database, TaskRecord, context.context('a'), { maxObservableItems: 1 });
        try { await collection.observeIterable(); } catch (failure) { error = failure; }
    });
    it('should fail instead of publishing a partial snapshot and close the stream', () => {
        String(error).should.contain('exceeds maxObservableItems');
        close.calledOnce.should.equal(true);
    });
}));
