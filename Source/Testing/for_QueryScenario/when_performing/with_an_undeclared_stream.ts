// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { query, readModel } from '@cratis/arc.core';
import { Observable, Subject } from 'rxjs';
import { QueryScenario } from '../../QueryScenario.js';

const started = vi.fn();
const shared = new Subject<number>();
let generatorStarted = 0;
async function* values() { generatorStarted++; yield 1; }
let onDispose = () => {};
const slowDispose = vi.fn(() => { onDispose(); return new Promise<void>(() => {}); });
const failingDispose = vi.fn(() => { throw new Error('cleanup failed'); });
class OwnedObservable extends Observable<number> {
    [Symbol.asyncDispose](): Promise<void> { return slowDispose(); }
}
class FailingObservable extends Observable<number> {
    [Symbol.dispose](): void { failingDispose(); }
}
@readModel()
class SnapshotStream {
    @query() static cold() { return new Observable<number>(() => { started(); }); }
    @query() static subject() { return shared; }
    @query() static iterable() { return { [Symbol.asyncIterator]: values }; }
    @query() static slow() { return new OwnedObservable(); }
    @query() static failing() { return new FailingObservable(); }
}

describe('when a snapshot query returns a cold observable in a scenario', () => {
    let scenario: QueryScenario;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        started.mockClear();
        scenario = QueryScenario.for(SnapshotStream, 'cold');
        result = await scenario.perform();
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should not start the producer', () => { started.mock.calls.should.have.lengthOf(0); });
    it('should report the boundary failure', () => { result.exceptionMessages.join(' ').should.contain('returned an observable'); });
});

describe('when a snapshot query returns a shared Subject in a scenario', () => {
    let scenario: QueryScenario;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    let received: number[];
    beforeEach(async () => {
        received = [];
        const subscription = shared.subscribe(value => received.push(value));
        scenario = QueryScenario.for(SnapshotStream, 'subject');
        try { result = await scenario.perform(); shared.next(42); }
        finally { subscription.unsubscribe(); }
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should leave existing subscribers alone', () => { received.should.deep.equal([42]); });
    it('should report the boundary failure', () => { result.exceptionMessages.join(' ').should.contain('returned an observable'); });
});

describe('when a snapshot query returns an async iterable in a scenario', () => {
    let scenario: QueryScenario;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        generatorStarted = 0;
        scenario = QueryScenario.for(SnapshotStream, 'iterable');
        result = await scenario.perform();
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should not start an iterator', () => { generatorStarted.should.equal(0); });
    it('should report the boundary failure', () => { result.exceptionMessages.join(' ').should.contain('returned an observable'); });
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
    it('should preserve the snapshot rejection and report the cleanup failure', () => {
        failingDispose.mock.calls.should.have.lengthOf(1);
        result.exceptionMessages.join(' ').should.contain('returned an observable');
        result.exceptionMessages.join(' ').should.contain('cleanup failed');
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
        const startedAt = Date.now();
        result = await scenario.perform();
        elapsed = Date.now() - startedAt;
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
