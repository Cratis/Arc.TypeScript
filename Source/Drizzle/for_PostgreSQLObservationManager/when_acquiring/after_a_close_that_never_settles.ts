// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { database, Listener, managerFor, table } from '../given/a_manager.js';

describe('when a listener close never settles', () => {
    it('should fail a waiting acquisition within the operation timeout, open no other listener and report the close deadline', async () => {
        const first = new Listener();
        first.close = () => { first.closeCount++; return new Promise<void>(() => {}); };
        let calls = 0;
        const manager = managerFor(() => { calls++; return calls === 1 ? first : new Listener(); }, 20);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        await lease.ready;
        vi.useFakeTimers();
        try {
            lease.release();
            const replacement = manager.acquire('tenant', database, table, () => {}, () => {});
            const outcome = replacement.ready.then(() => 'ready', (error: Error) => error.message);
            await vi.advanceTimersByTimeAsync(20);
            const result = await outcome;
            result.should.include('could not start');
            calls.should.equal(1);
            const failure = await manager[Symbol.asyncDispose]().then(() => undefined, error => error as AggregateError);
            const timedOut = failure!.errors.some(error => (error as Error).message === 'PostgreSQL listener close timed out');
            timedOut.should.equal(true);
        } finally { vi.useRealTimers(); }
    });
});
