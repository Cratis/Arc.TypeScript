// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { database, deferred, Listener, managerFor, table } from '../given/a_manager.js';

describe('when a listener close is still in progress', () => {
    it('should wait for actual closure before starting a new listener', async () => {
        const first = new Listener();
        const ending = deferred<void>();
        first.close = () => { first.closeCount++; return ending.promise; };
        let calls = 0;
        const manager = managerFor(() => { calls++; return calls === 1 ? first : new Listener(); }, 50);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        await lease.ready;
        vi.useFakeTimers();
        try {
            lease.release();
            const replacement = manager.acquire('tenant', database, table, () => {}, () => {});
            const outcome = replacement.ready.then(() => 'ready', () => 'failed');
            await vi.advanceTimersByTimeAsync(30);
            first.closeCount.should.equal(1);
            calls.should.equal(1);
            ending.resolve();
            (await outcome).should.equal('ready');
            calls.should.equal(2);
            replacement.release();
            await manager[Symbol.asyncDispose]();
        } finally { vi.useRealTimers(); }
    });
});
