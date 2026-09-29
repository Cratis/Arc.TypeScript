// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';
import { database, Listener, table } from '../given/a_manager.js';

describe('when a recovered listener passes its heartbeat', () => {
    it('should reset the retry budget before a later disconnect', async () => {
        vi.useFakeTimers();
        const first = new Listener();
        const recovered = new Listener();
        const last = new Listener();
        let calls = 0;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => { calls++;
                if (calls === 1) return first;
                if (calls === 3) return recovered;
                if (calls === 5) return last;
                throw new Error('temporary failure');
            } }, 10, 100, [1, 2]);
        const failures: Error[] = [];
        const updates: number[] = [];
        try {
            const lease = manager.acquire('tenant', database, table, forced => { if (forced) updates.push(calls); }, error => failures.push(error));
            await lease.ready;
            first.disconnect?.();
            await vi.advanceTimersByTimeAsync(3);
            calls.should.equal(3);
            updates.should.deep.equal([3]);
            await vi.advanceTimersByTimeAsync(10);
            recovered.disconnect?.();
            await vi.advanceTimersByTimeAsync(3);
            calls.should.equal(5);
            updates.should.deep.equal([3, 5]);
            failures.should.have.lengthOf(0);
            lease.release();
            await manager[Symbol.asyncDispose]();
        } finally { vi.useRealTimers(); }
    });
});
