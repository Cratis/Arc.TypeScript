// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { compileQueries } from '../../compileQueries.js';
import { query } from '../../query.js';
import { readModel } from '../../readModel.js';
import { Severity } from '../../../../validation/Severity.js';
import { ServiceRegistry } from '../../../../dependencyInjection/ServiceRegistry.js';
import { ServiceScope, withServices } from '../../../../dependencyInjection/ServiceScope.js';

const unsubscribe = vi.fn();
const dispose = vi.fn();
const returned = vi.fn();
const asyncDispose = vi.fn();
@readModel()
class SnapshotStreams {
    @query() static subscribable() { return { subscribe: () => ({}), unsubscribe }; }
    @query() static disposable() { return { subscribe: () => ({}), dispose }; }
    @query() static asyncIterable() { return { [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true as const, value: undefined }), return: returned }) }; }
    @query() static failingCleanup() { return { subscribe: () => ({}), [Symbol.asyncDispose]: asyncDispose }; }
}

const perform = async (name: string) => {
    const query = compileQueries(SnapshotStreams, 'Specs').find(item => item.definition.name === name)!;
    if (!('perform' in query.definition)) throw new Error('Expected a snapshot');
    const handler = query.definition.perform;
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
    it('should unsubscribe exactly once before rejection', () => { unsubscribe.mock.calls.should.have.lengthOf(1); });
    it('should reject the snapshot stream', () => { (error as Error).message.should.contain('returned an observable'); });
});

describe('when a snapshot returns a disposable stream', () => {
    let error: unknown;
    beforeEach(async () => {
        dispose.mockClear();
        try { await perform('disposable'); } catch (caught) { error = caught; }
    });
    it('should dispose exactly once before rejection', () => { dispose.mock.calls.should.have.lengthOf(1); });
    it('should reject the snapshot stream', () => { (error as Error).message.should.contain('returned an observable'); });
});

describe('when a snapshot returns an async iterable', () => {
    let error: unknown;
    beforeEach(async () => {
        returned.mockClear();
        try { await perform('asyncIterable'); } catch (caught) { error = caught; }
    });
    it('should return the iterator exactly once before rejection', () => { returned.mock.calls.should.have.lengthOf(1); });
    it('should reject the snapshot stream', () => { (error as Error).message.should.contain('returned an observable'); });
});

describe('when snapshot producer cleanup fails', () => {
    let error: unknown;
    beforeEach(async () => {
        asyncDispose.mockReset().mockRejectedValue(new Error('cleanup failed'));
        try { await perform('failingCleanup'); } catch (caught) { error = caught; }
    });
    it('should attempt cleanup only once', () => { asyncDispose.mock.calls.should.have.lengthOf(1); });
    it('should preserve the snapshot rejection', () => { (error as Error).message.should.contain('returned an observable'); });
});
