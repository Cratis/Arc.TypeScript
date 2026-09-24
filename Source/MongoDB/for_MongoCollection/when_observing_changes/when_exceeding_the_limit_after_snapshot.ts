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
describe('when the observable limit is exceeded after the snapshot', given(a_replica_set, context => {
    it('should fail the subscriber and close the stream', async () => {
        const stream = { next: sinon.stub().resolves({}), tryNext: sinon.stub().resolves(null), close: sinon.stub().resolves() };
        const toArray = sinon.stub().onFirstCall().resolves([]).onSecondCall().resolves([{}, {}]);
        const native = { watch: sinon.stub().returns(stream), find: sinon.stub().returns({
            limit: sinon.stub().returns({ toArray })
        }) } as unknown as Collection<Document>;
        const database = { command: sinon.stub().resolves({ setName: 'rs0', operationTime: new Timestamp({ t: 1, i: 1 }) }) } as unknown as Db;
        const collection = new MongoCollection(native, database, TaskRecord, context.context('a'), { maxObservableItems: 1 });
        const observation = await collection.observe();
        const iterator = observation[Symbol.asyncIterator]();
        (await iterator.next()).value.should.deep.equal([]);
        try { await iterator.next(); throw new Error('Expected limit failure'); }
        catch (error) { String(error).should.contain('exceeds maxObservableItems'); }
        stream.close.calledOnce.should.equal(true);
    });
}));
