// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import sinon from 'sinon';
import type { ChangeStream, Document } from 'mongodb';
import { MongoObservation } from '../../MongoObservation.js';

should();
describe('when observing a burst of queued changes', () => {
    it('should read only once for all changes already queued', async () => {
        const read = sinon.stub().resolves(4);
        const stream = { next: sinon.stub().resolves({}), tryNext: sinon.stub().onFirstCall().resolves({})
            .onSecondCall().resolves({}).onThirdCall().resolves(null), close: sinon.stub().resolves() };
        const observation = new MongoObservation(stream as unknown as ChangeStream<Document>, read, 0,
            new AbortController().signal, () => {});
        const iterator = observation[Symbol.asyncIterator]();
        (await iterator.next()).value.should.equal(0);
        (await iterator.next()).value.should.equal(4);
        read.calledOnce.should.equal(true);
        stream.tryNext.callCount.should.equal(3);
        await iterator.return(0);
    });
    it('should propagate a stream failure to the subscriber and release the cursor', async () => {
        const release = sinon.spy();
        const stream = { next: sinon.stub().rejects(new Error('stream failed')), close: sinon.stub().resolves() };
        const observation = new MongoObservation(stream as unknown as ChangeStream<Document>, async () => 1, 0,
            new AbortController().signal, release);
        const iterator = observation[Symbol.asyncIterator]();
        await iterator.next();
        try { await iterator.next(); throw new Error('Expected stream failure'); }
        catch (error) { String(error).should.contain('stream failed'); }
        stream.close.calledOnce.should.equal(true);
        release.calledOnce.should.equal(true);
    });
    it('should close the cursor when the execution is aborted', async () => {
        const controller = new AbortController();
        const close = sinon.stub().resolves();
        new MongoObservation({ close } as unknown as ChangeStream<Document>, async () => 1, 0,
            controller.signal, () => {});
        controller.abort();
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        close.calledOnce.should.equal(true);
    });
});
