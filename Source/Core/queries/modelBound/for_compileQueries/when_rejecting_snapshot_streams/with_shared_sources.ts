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
let shared: Subject<number>;
let generatorStarted = 0;
async function* values() { generatorStarted++; yield 1; }
const unsubscribe = vi.fn();
const dispose = vi.fn();
const returned = vi.fn(async () => ({ done: true, value: undefined }));
const lowerPriority = { dispose: vi.fn(), close: vi.fn(), unsubscribe: vi.fn(), return: vi.fn() };
const syncPriority = { [Symbol.dispose]: vi.fn(), dispose: vi.fn() };
const closePriority = { close: vi.fn(), unsubscribe: vi.fn() };
let abortBeforeReturn: AbortController;
let abortDuringRelease: AbortController;
const failingAfterAbort = vi.fn(async () => {
    abortDuringRelease.abort();
    throw new Error('release failed after abort');
});
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
    @query() static subscribable() { return { subscribe: () => ({}), unsubscribe }; }
    @query() static ordered() { return { subscribe: () => ({}), [Symbol.asyncDispose]: () => owned.release(),
        [Symbol.dispose]: syncPriority[Symbol.dispose], ...lowerPriority, next: () => ({ done: true, value: undefined }) }; }
    @query() static syncPriority() { return { subscribe: () => ({}), ...syncPriority }; }
    @query() static namedPriority() { return { subscribe: () => ({}), ...lowerPriority,
        next: () => ({ done: true, value: undefined }) }; }
    @query() static closePriority() { return { subscribe: () => ({}), ...closePriority }; }
    @query() static disposable() { return { subscribe: () => ({}), dispose }; }
    @query() static iterator() { return { next: async () => ({ done: true, value: undefined }), return: returned,
        [Symbol.asyncIterator]() { return this; } }; }
    @query() static sharedSubject() { return shared; }
    @query() static aborted() {
        abortBeforeReturn.abort();
        return { subscribe: () => ({}), dispose: () => { throw new Error('release failed after prior abort'); } };
    }
    @query() static aborting() { return { subscribe: () => ({}), [Symbol.asyncDispose]: failingAfterAbort }; }
}

const perform = async (name: string, signal = new AbortController().signal) => {
    const compiled = compileQueries(SnapshotStreams, 'Specs').find(item => item.definition.name === name)!;
    if (!('perform' in compiled.definition)) throw new Error('Expected a snapshot');
    const handler = compiled.definition.perform;
    const context = { correlationId: 'spec', allowedSeverity: Severity.Warning,
        principal: undefined, tenantId: undefined, signal };
    const registry = new ServiceRegistry();
    const scope = new ServiceScope(registry, context);
    try { return await withServices(scope, () => handler({}, context, {})); }
    finally { await scope.dispose(); await registry.dispose(); }
};

const rejection = async (name: string, signal?: AbortSignal): Promise<unknown> => {
    try { await perform(name, signal); } catch (error) { return error; }
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

describe('when a snapshot returns an object with every release hook', () => {
    beforeEach(async () => {
        owned.release.mockClear(); syncPriority[Symbol.dispose].mockClear();
        Object.values(lowerPriority).forEach(hook => hook.mockClear());
        await rejection('ordered');
    });
    it('should prefer async disposal over all other hooks', () => {
        owned.release.mock.calls.should.have.lengthOf(1);
        syncPriority[Symbol.dispose].mock.calls.should.have.lengthOf(0);
        Object.values(lowerPriority).forEach(hook => hook.mock.calls.should.have.lengthOf(0));
    });
});

describe('when a snapshot has both sync and named disposal', () => {
    beforeEach(async () => {
        syncPriority[Symbol.dispose].mockClear(); syncPriority.dispose.mockClear();
        await rejection('syncPriority');
    });
    it('should prefer sync disposal', () => {
        syncPriority[Symbol.dispose].mock.calls.should.have.lengthOf(1);
        syncPriority.dispose.mock.calls.should.have.lengthOf(0);
    });
});

describe('when a snapshot has named disposal and lower-priority hooks', () => {
    beforeEach(async () => {
        Object.values(lowerPriority).forEach(hook => hook.mockClear());
        await rejection('namedPriority');
    });
    it('should prefer dispose over close, unsubscribe, and iterator return', () => {
        lowerPriority.dispose.mock.calls.should.have.lengthOf(1);
        lowerPriority.close.mock.calls.should.have.lengthOf(0);
        lowerPriority.unsubscribe.mock.calls.should.have.lengthOf(0);
        lowerPriority.return.mock.calls.should.have.lengthOf(0);
    });
});

describe('when a snapshot has both close and unsubscribe', () => {
    beforeEach(async () => {
        closePriority.close.mockClear(); closePriority.unsubscribe.mockClear();
        await rejection('closePriority');
    });
    it('should prefer close', () => {
        closePriority.close.mock.calls.should.have.lengthOf(1);
        closePriority.unsubscribe.mock.calls.should.have.lengthOf(0);
    });
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

describe('when a snapshot returns a subscribable with its own unsubscribe hook', () => {
    let error: unknown;
    beforeEach(async () => { unsubscribe.mockClear(); error = await rejection('subscribable'); });
    it('should unsubscribe exactly once before rejecting the snapshot', () => {
        unsubscribe.mock.calls.should.have.lengthOf(1);
        (error instanceof SnapshotStreamError).should.equal(true);
    });
});

describe('when a snapshot returns a subscribable with its own dispose hook', () => {
    let error: unknown;
    beforeEach(async () => { dispose.mockClear(); error = await rejection('disposable'); });
    it('should dispose exactly once before rejecting the snapshot', () => {
        dispose.mock.calls.should.have.lengthOf(1);
        (error instanceof SnapshotStreamError).should.equal(true);
    });
});

describe('when a snapshot returns an already-created iterator', () => {
    let error: unknown;
    beforeEach(async () => { returned.mockClear(); error = await rejection('iterator'); });
    it('should return the object itself exactly once', () => {
        returned.mock.calls.should.have.lengthOf(1);
        (error instanceof SnapshotStreamError).should.equal(true);
    });
});

describe('when the request aborts before returning a disposable stream', () => {
    let error: unknown;
    beforeEach(async () => {
        abortBeforeReturn = new AbortController();
        error = await rejection('aborted', abortBeforeReturn.signal);
    });
    it('should report the release failure alongside the snapshot rejection', () => {
        abortBeforeReturn.signal.aborted.should.equal(true);
        (error as AggregateError).errors[0].should.be.instanceOf(SnapshotStreamError);
        (error as AggregateError).errors[1].message.should.equal('release failed after prior abort');
    });
});

describe('when the request aborts during asynchronous release', () => {
    let error: unknown;
    beforeEach(async () => {
        abortDuringRelease = new AbortController();
        failingAfterAbort.mockClear();
        error = await rejection('aborting', abortDuringRelease.signal);
    });
    it('should report the asynchronous release failure alongside the snapshot rejection', () => {
        abortDuringRelease.signal.aborted.should.equal(true);
        failingAfterAbort.mock.calls.should.have.lengthOf(1);
        (error as AggregateError).errors[0].should.be.instanceOf(SnapshotStreamError);
        (error as AggregateError).errors[1].message.should.equal('release failed after abort');
    });
});

describe('when a snapshot returns a Subject', () => {
    let error: unknown;
    let received: number[];
    beforeEach(async () => {
        shared = new Subject<number>();
        received = [];
        const subscription = shared.subscribe(value => received.push(value));
        try { error = await rejection('sharedSubject'); }
        finally { subscription.unsubscribe(); }
    });
    it('should reject the snapshot stream', () => { (error instanceof SnapshotStreamError).should.equal(true); });
    it('should close the Subject through its own unsubscribe hook', () => { shared.closed.should.equal(true); });
    it('should stop existing subscribers', () => { received.should.deep.equal([]); });
});
