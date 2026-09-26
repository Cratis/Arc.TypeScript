// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { query, readModel } from '@cratis/arc.core';
import { QueryScenario } from '../../QueryScenario.js';

const unsubscribe = vi.fn();
const iteratorCreated = vi.fn();
const iteratorReturned = vi.fn();
let onDispose = () => {};
const slowDispose = vi.fn(() => { onDispose(); return new Promise<void>(() => {}); });
const failingDispose = vi.fn(() => { throw new Error('cleanup failed'); });
@readModel()
class SnapshotStream {
    @query() static subscribable() { return { subscribe: () => ({}), unsubscribe }; }
    @query() static iterable() { return { [Symbol.asyncIterator]: iteratorCreated }; }
    @query() static slow() { return { subscribe: () => ({}), [Symbol.asyncDispose]: slowDispose }; }
    @query() static failing() { return { subscribe: () => ({}), [Symbol.dispose]: failingDispose }; }
}

describe('when a snapshot query returns a subscribable in a scenario', () => {
    let scenario: QueryScenario;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        unsubscribe.mockClear();
        scenario = QueryScenario.for(SnapshotStream, 'subscribable');
        result = await scenario.perform();
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should unsubscribe before reporting the boundary failure', () => {
        unsubscribe.mock.calls.should.have.lengthOf(1);
        result.exceptionMessages.join(' ').should.contain('returned an observable');
    });
});

describe('when a snapshot query returns an async iterable in a scenario', () => {
    let scenario: QueryScenario;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        iteratorReturned.mockClear();
        iteratorCreated.mockClear().mockReturnValue({ return: iteratorReturned.mockResolvedValue({ done: true, value: undefined }) });
        scenario = QueryScenario.for(SnapshotStream, 'iterable');
        result = await scenario.perform();
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should return the scenario-created iterator before reporting the boundary failure', () => {
        iteratorCreated.mock.calls.should.have.lengthOf(1);
        iteratorReturned.mock.calls.should.have.lengthOf(1);
        result.exceptionMessages.join(' ').should.contain('returned an observable');
    });
});

describe('when snapshot producer cleanup fails in a scenario', () => {
    let scenario: QueryScenario;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        failingDispose.mockClear();
        scenario = QueryScenario.for(SnapshotStream, 'failing');
        result = await scenario.perform();
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should preserve the snapshot rejection after attempting cleanup', () => {
        failingDispose.mock.calls.should.have.lengthOf(1);
        result.exceptionMessages.join(' ').should.contain('returned an observable');
    });
});

describe('when snapshot producer cleanup never completes', () => {
    let scenario: QueryScenario;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    let elapsed: number;
    beforeEach(async () => {
        slowDispose.mockClear();
        onDispose = () => {};
        scenario = QueryScenario.for(SnapshotStream, 'slow');
        const started = Date.now();
        result = await scenario.perform();
        elapsed = Date.now() - started;
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should stop waiting and retain the boundary failure', () => {
        slowDispose.mock.calls.should.have.lengthOf(1);
        elapsed.should.be.lessThan(3_000);
        result.exceptionMessages.join(' ').should.contain('returned an observable');
    });
});

describe('when snapshot cleanup is canceled', () => {
    let scenario: QueryScenario;
    beforeEach(() => {
        vi.useFakeTimers();
        slowDispose.mockClear();
        const controller = new AbortController();
        onDispose = () => controller.abort();
        scenario = QueryScenario.for(SnapshotStream, 'slow').withContext({ signal: controller.signal });
    });
    afterEach(async () => {
        vi.useRealTimers();
        await scenario.dispose();
    });
    it('should stop waiting on cleanup after cancellation', async () => {
        let settled = false;
        const performing = scenario.perform().then(result => { settled = true; return result; });
        await vi.advanceTimersByTimeAsync(0);
        slowDispose.mock.calls.should.have.lengthOf(1);
        settled.should.equal(true);
        const result = await performing;
        result.exceptionMessages.join(' ').should.contain('returned an observable');
    });
});
