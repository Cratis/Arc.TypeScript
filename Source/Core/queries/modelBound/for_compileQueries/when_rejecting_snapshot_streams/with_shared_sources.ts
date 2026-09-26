// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Subject } from 'rxjs';
import { compileQueries } from '../../compileQueries.js';
import { query } from '../../query.js';
import { readModel } from '../../readModel.js';
import { Severity } from '../../../../validation/Severity.js';
import { ServiceRegistry } from '../../../../dependencyInjection/ServiceRegistry.js';
import { ServiceScope, withServices } from '../../../../dependencyInjection/ServiceScope.js';

const unsubscribe = vi.fn();
const dispose = vi.fn();
const iterator = vi.fn();
const shared = new Subject<number>();
@readModel()
class SnapshotStreams {
    @query() static subscribable() { return { subscribe: () => ({}), unsubscribe }; }
    @query() static disposable() { return { subscribe: () => ({}), dispose }; }
    @query() static asyncIterable() { return { [Symbol.asyncIterator]: iterator }; }
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
    it('should leave the returned source alone', () => { unsubscribe.mock.calls.should.have.lengthOf(0); });
    it('should reject the snapshot stream', () => { (error as Error).message.should.contain('returned an observable'); });
});

describe('when a snapshot returns a disposable stream', () => {
    let error: unknown;
    beforeEach(async () => {
        dispose.mockClear();
        try { await perform('disposable'); } catch (caught) { error = caught; }
    });
    it('should not dispose the returned source', () => { dispose.mock.calls.should.have.lengthOf(0); });
    it('should reject the snapshot stream', () => { (error as Error).message.should.contain('returned an observable'); });
});

describe('when a snapshot returns an async iterable', () => {
    let error: unknown;
    beforeEach(async () => {
        iterator.mockClear();
        try { await perform('asyncIterable'); } catch (caught) { error = caught; }
    });
    it('should not create an iterator', () => { iterator.mock.calls.should.have.lengthOf(0); });
    it('should reject the snapshot stream', () => { (error as Error).message.should.contain('returned an observable'); });
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
    it('should reject the snapshot stream', () => { (error as Error).message.should.contain('returned an observable'); });
    it('should allow another subscriber to receive later emissions', () => { received.should.deep.equal([42]); });
});
