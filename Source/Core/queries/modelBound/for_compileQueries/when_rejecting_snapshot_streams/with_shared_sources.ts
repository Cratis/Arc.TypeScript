// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Subject } from 'rxjs';
import { compileQueries } from '../../compileQueries.js';
import { query } from '../../query.js';
import { readModel } from '../../readModel.js';
import { SnapshotStreamError } from '../../snapshotStreamSource.js';
import { Severity } from '../../../../validation/Severity.js';
import { ServiceRegistry } from '../../../../dependencyInjection/ServiceRegistry.js';
import { ServiceScope, withServices } from '../../../../dependencyInjection/ServiceScope.js';

const unsubscribe = vi.fn();
const dispose = vi.fn();
const iteratorReturned = vi.fn();
const iterator = vi.fn();
const teardown = vi.fn();
const shared = new Subject<number>();
const cleanupFailure = new Error('cleanup failed');
const failingTeardown = vi.fn(() => { throw cleanupFailure; });
@readModel()
class SnapshotStreams {
    @query() static subscribable() { return { subscribe: () => ({}), unsubscribe }; }
    @query() static disposable() { return { subscribe: () => ({}), dispose }; }
    @query() static asyncIterable() { return { [Symbol.asyncIterator]: iterator }; }
    @query() static teardown() { return { subscribe: () => teardown }; }
    @query() static failing() { return { subscribe: () => ({ unsubscribe: failingTeardown }) }; }
    @query() static sharedSubject() { return shared; }
}

const perform = async (name: string) => {
    const compiled = compileQueries(SnapshotStreams, 'Specs').find(item => item.definition.name === name)!;
    if (!('perform' in compiled.definition)) throw new Error('Expected a snapshot');
    const handler = compiled.definition.perform;
    const context = { correlationId: 'spec', allowedSeverity: Severity.Warning,
        principal: undefined, tenantId: undefined, signal: new AbortController().signal };
    const registry = new ServiceRegistry();
    const scope = new ServiceScope(registry, context);
    try { return await withServices(scope, () => handler({}, context, {})); }
    finally { await scope.dispose(); await registry.dispose(); }
};

describe('when a snapshot returns a subscribable', () => {
    let error: unknown;
    beforeEach(async () => {
        unsubscribe.mockClear();
        try { await perform('subscribable'); } catch (caught) { error = caught; }
    });
    it('should unsubscribe exactly once', () => { unsubscribe.mock.calls.should.have.lengthOf(1); });
    it('should reject the snapshot stream', () => { (error instanceof SnapshotStreamError).should.equal(true); });
});

describe('when a snapshot returns a disposable stream', () => {
    let error: unknown;
    beforeEach(async () => {
        dispose.mockClear();
        try { await perform('disposable'); } catch (caught) { error = caught; }
    });
    it('should dispose exactly once', () => { dispose.mock.calls.should.have.lengthOf(1); });
    it('should reject the snapshot stream', () => { (error instanceof SnapshotStreamError).should.equal(true); });
});

describe('when a snapshot returns an async iterable', () => {
    let error: unknown;
    beforeEach(async () => {
        iteratorReturned.mockClear().mockResolvedValue({ done: true, value: undefined });
        iterator.mockClear().mockReturnValue({ return: iteratorReturned });
        try { await perform('asyncIterable'); } catch (caught) { error = caught; }
    });
    it('should create exactly one iterator', () => { iterator.mock.calls.should.have.lengthOf(1); });
    it('should return that iterator exactly once', () => { iteratorReturned.mock.calls.should.have.lengthOf(1); });
    it('should reject the snapshot stream', () => { (error instanceof SnapshotStreamError).should.equal(true); });
});

describe('when a snapshot subscribable returns a teardown function', () => {
    let error: unknown;
    beforeEach(async () => {
        teardown.mockClear();
        try { await perform('teardown'); } catch (caught) { error = caught; }
    });
    it('should call the teardown exactly once', () => { teardown.mock.calls.should.have.lengthOf(1); });
    it('should reject the snapshot stream', () => { (error instanceof SnapshotStreamError).should.equal(true); });
});

describe('when snapshot stream teardown throws', () => {
    let error: unknown;
    beforeEach(async () => {
        failingTeardown.mockClear();
        try { await perform('failing'); } catch (caught) { error = caught; }
    });
    it('should attempt teardown exactly once', () => { failingTeardown.mock.calls.should.have.lengthOf(1); });
    it('should preserve both the rejection and the cleanup failure', () => {
        (error instanceof AggregateError).should.equal(true);
        (error as AggregateError).errors[0].should.be.instanceOf(SnapshotStreamError);
        (error as AggregateError).errors[1].should.equal(cleanupFailure);
    });
});

describe('when a snapshot returns a shared Subject', () => {
    let error: unknown;
    let received: number[];
    beforeEach(async () => {
        received = [];
        const subscription = shared.subscribe(value => received.push(value));
        try { await perform('sharedSubject'); } catch (caught) { error = caught; }
        shared.next(42);
        subscription.unsubscribe();
    });
    it('should reject the snapshot stream', () => { (error instanceof SnapshotStreamError).should.equal(true); });
    it('should allow another subscriber to receive later emissions', () => { received.should.deep.equal([42]); });
});
