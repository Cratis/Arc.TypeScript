// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import sinon from 'sinon';
import type { ChangeStream, Document } from 'mongodb';
import { query, readModel } from '@cratis/arc.core';
import { QueryScenario } from '@cratis/arc.testing';
import { MongoObservable } from '../../MongoObservable.js';
import { MongoObservation } from '../../MongoObservation.js';

should();
@readModel()
class SnapshotMongo {
    static source: MongoObservable<number>;
    static observation: MongoObservation<number>;
    @query() static observable() { return SnapshotMongo.source; }
    @query() static iterable() { return SnapshotMongo.observation; }
}

describe('when a snapshot query rejects an unopened MongoObservable', () => {
    it('should not open a change stream or start a read', async () => {
        const open = sinon.stub().rejects(new Error('should not open'));
        SnapshotMongo.source = new MongoObservable<number>(open);
        const scenario = QueryScenario.for(SnapshotMongo, 'observable');
        try {
            const result = await scenario.perform();
            result.exceptionMessages.join(' ').should.contain('returned an observable');
            open.notCalled.should.equal(true);
        } finally { await scenario.dispose(); }
    });
});

describe('when a snapshot query rejects a primed MongoObservable', () => {
    it('should close its pending observation once without starting an iterator', async () => {
        const close = sinon.stub().resolves();
        const next = sinon.stub();
        const read = sinon.stub().resolves(2);
        const stream = { close, next } as unknown as ChangeStream<Document>;
        const observation = new MongoObservation(stream, read, 1, new AbortController().signal, () => {});
        const open = sinon.stub().resolves(observation);
        SnapshotMongo.source = new MongoObservable<number>(open);
        (await SnapshotMongo.source.current()).value.should.equal(1);
        const scenario = QueryScenario.for(SnapshotMongo, 'observable');
        try {
            const result = await scenario.perform();
            result.exceptionMessages.join(' ').should.contain('returned an observable');
            open.calledOnce.should.equal(true);
            close.calledOnce.should.equal(true);
            next.notCalled.should.equal(true);
            read.notCalled.should.equal(true);
        } finally { await scenario.dispose(); }
    });
});

describe('when a snapshot query rejects an eagerly opened MongoObservation', () => {
    it('should close the change stream once without starting the async generator', async () => {
        const close = sinon.stub().resolves();
        const next = sinon.stub();
        const read = sinon.stub().resolves(2);
        const stream = { close, next } as unknown as ChangeStream<Document>;
        SnapshotMongo.observation = new MongoObservation(stream, read, 1, new AbortController().signal, () => {});
        const scenario = QueryScenario.for(SnapshotMongo, 'iterable');
        try {
            const result = await scenario.perform();
            result.exceptionMessages.join(' ').should.contain('returned an observable');
            close.calledOnce.should.equal(true);
            next.notCalled.should.equal(true);
            read.notCalled.should.equal(true);
        } finally { await scenario.dispose(); }
    });
});
