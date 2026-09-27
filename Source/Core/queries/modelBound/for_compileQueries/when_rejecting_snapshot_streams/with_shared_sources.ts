// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Observable, Subject } from 'rxjs';
import { compileQueries } from '../../compileQueries.js';
import { query } from '../../query.js';
import { readModel } from '../../readModel.js';
import { SnapshotStreamError } from '../../snapshotStreamSource.js';
import { Severity } from '../../../../validation/Severity.js';
import { ServiceRegistry } from '../../../../dependencyInjection/ServiceRegistry.js';
import { ServiceScope, withServices } from '../../../../dependencyInjection/ServiceScope.js';

const started = vi.fn();
const cold = new Observable<number>(() => { started(); });
const shared = new Subject<number>();
let generatorStarted = 0;
async function* values() { generatorStarted++; yield 1; }
const cleanupFailure = new Error('cleanup failed');
class OwnedObservable extends Observable<number> {
    readonly release = vi.fn();
    readonly syncRelease = vi.fn();
    readonly close = vi.fn();
    [Symbol.asyncDispose](): Promise<void> { this.release(); return Promise.resolve(); }
    [Symbol.dispose](): void { this.syncRelease(); }
}
class FailingObservable extends Observable<number> {
    readonly release = vi.fn(() => { throw cleanupFailure; });
    async [Symbol.asyncDispose](): Promise<void> { this.release(); }
}
class ClosableObservable extends Observable<number> {
    readonly close = vi.fn();
}
const owned = new OwnedObservable();
const failing = new FailingObservable();
const closable = new ClosableObservable();
@readModel()
class SnapshotStreams {
    @query() static cold() { return cold; }
    @query() static iterable() { return { [Symbol.asyncIterator]: values }; }
    @query() static owned() { return owned; }
    @query() static failing() { return failing; }
    @query() static closable() { return closable; }
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

const rejection = async (name: string): Promise<unknown> => {
    try { await perform(name); } catch (error) { return error; }
    throw new Error('Expected snapshot rejection');
};

describe('when a snapshot returns a cold RxJS Observable', () => {
    let error: unknown;
    beforeEach(async () => { started.mockClear(); error = await rejection('cold'); });
    it('should not start the producer', () => { started.mock.calls.should.have.lengthOf(0); });
    it('should reject the snapshot stream', () => { (error instanceof SnapshotStreamError).should.equal(true); });
});

describe('when a snapshot returns an async-generator-backed iterable without a disposal hook', () => {
    let error: unknown;
    beforeEach(async () => { generatorStarted = 0; error = await rejection('iterable'); });
    it('should not start a fresh iterator', () => { generatorStarted.should.equal(0); });
    it('should reject the snapshot stream', () => { (error instanceof SnapshotStreamError).should.equal(true); });
});

describe('when a snapshot returns an observable with its own disposal hooks', () => {
    let error: unknown;
    beforeEach(async () => {
        owned.release.mockClear(); owned.syncRelease.mockClear(); owned.close.mockClear();
        error = await rejection('owned');
    });
    it('should call async disposal exactly once', () => { owned.release.mock.calls.should.have.lengthOf(1); });
    it('should prefer async disposal over sync disposal and close', () => {
        owned.syncRelease.mock.calls.should.have.lengthOf(0);
        owned.close.mock.calls.should.have.lengthOf(0);
    });
    it('should reject the snapshot stream', () => { (error instanceof SnapshotStreamError).should.equal(true); });
});

describe('when a snapshot returns an observable with a close method', () => {
    let error: unknown;
    beforeEach(async () => { closable.close.mockClear(); error = await rejection('closable'); });
    it('should close the source exactly once', () => { closable.close.mock.calls.should.have.lengthOf(1); });
    it('should reject the snapshot stream', () => { (error instanceof SnapshotStreamError).should.equal(true); });
});

describe('when snapshot stream disposal throws', () => {
    let error: unknown;
    beforeEach(async () => { failing.release.mockClear(); error = await rejection('failing'); });
    it('should attempt disposal exactly once', () => { failing.release.mock.calls.should.have.lengthOf(1); });
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
        try { error = await rejection('sharedSubject'); shared.next(42); }
        finally { subscription.unsubscribe(); }
    });
    it('should reject the snapshot stream', () => { (error instanceof SnapshotStreamError).should.equal(true); });
    it('should leave another subscriber receiving emissions', () => { received.should.deep.equal([42]); });
    it('should leave the Subject open', () => { shared.closed.should.equal(false); });
});
