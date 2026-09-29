// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { database, Listener, table } from '../given/a_manager.js';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';

describe('when the PostgreSQL reconnect attempts fail', () => {
    it('should observe every backoff deadline once and then fail the leases', async () => {
        vi.useFakeTimers();
        const first = new Listener();
        let attempts = 0;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => { if (++attempts === 1) return first; throw new Error('connection unavailable'); } },
        60_000, 100, [10, 20, 40]);
        const errors: Error[] = [];
        try {
            const lease = manager.acquire('tenant', database, table, () => {}, error => errors.push(error));
            await lease.ready;
            first.disconnect?.();
            await vi.advanceTimersByTimeAsync(9);
            attempts.should.equal(1);
            await vi.advanceTimersByTimeAsync(1);
            attempts.should.equal(2);
            await vi.advanceTimersByTimeAsync(19);
            attempts.should.equal(2);
            await vi.advanceTimersByTimeAsync(1);
            attempts.should.equal(3);
            await vi.advanceTimersByTimeAsync(40);
            attempts.should.equal(4);
            errors.should.have.lengthOf(1);
            errors[0]!.message.should.include('recovery exhausted');
            lease.release();
            await manager[Symbol.asyncDispose]();
        } finally { vi.useRealTimers(); }
    });
});
