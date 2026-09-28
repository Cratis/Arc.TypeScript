// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';
import { database, deferred, Listener, table } from '../given/a_manager.js';

describe('when recovery is canceled', () => {
    for (const cancellation of ['dispose', 'release'] as const) {
        it(`should stop the retry timer on ${cancellation} during backoff`, async () => {
            vi.useFakeTimers();
            const first = new Listener();
            let calls = 0;
            const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
                listener: () => { calls++; return first; } }, 60_000, 100, [20]);
            try {
                const lease = manager.acquire('tenant', database, table, () => {}, () => {});
                await lease.ready;
                first.disconnect?.();
                if (cancellation === 'release') lease.release();
                await manager[Symbol.asyncDispose]();
                await vi.advanceTimersByTimeAsync(30);
                calls.should.equal(1);
                first.closeCount.should.equal(1);
                vi.getTimerCount().should.equal(0);
            } finally { vi.useRealTimers(); }
        });

        it(`should close a late factory result on ${cancellation} during reconnect`, async () => {
            const first = new Listener();
            const late = new Listener();
            const factory = deferred<Listener>();
            let calls = 0;
            const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
                listener: () => ++calls === 1 ? first : factory.promise }, 60_000, 100, [1]);
            const lease = manager.acquire('tenant', database, table, () => {}, () => {});
            try {
                await lease.ready;
                first.disconnect?.();
                await vi.waitFor(() => calls.should.equal(2));
                if (cancellation === 'release') lease.release();
                const disposal = manager[Symbol.asyncDispose]();
                factory.resolve(late);
                await disposal;
                await vi.waitFor(() => late.closeCount.should.equal(1));
                first.closeCount.should.equal(1);
                (late.notification === undefined).should.equal(true);
            } finally { factory.resolve(late); lease.release(); await manager[Symbol.asyncDispose](); }
        });
    }
});
