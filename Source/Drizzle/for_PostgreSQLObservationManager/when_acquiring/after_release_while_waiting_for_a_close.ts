// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { database, deferred, Listener, managerFor, table } from '../given/a_manager.js';

describe('when an acquisition is released while waiting for a previous close', () => {
    it('should settle promptly without opening another listener', async () => {
        const first = new Listener();
        const ending = deferred<void>();
        first.close = () => { first.closeCount++; return ending.promise; };
        let calls = 0;
        const manager = managerFor(() => { calls++; return calls === 1 ? first : new Listener(); }, 10_000);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        await lease.ready;
        vi.useFakeTimers();
        try {
            lease.release();
            const replacement = manager.acquire('tenant', database, table, () => {}, () => {});
            replacement.release();
            (await replacement.ready.then(() => 'ready', () => 'failed')).should.equal('failed');
            calls.should.equal(1);
            ending.resolve();
            await manager[Symbol.asyncDispose]();
        } finally { vi.useRealTimers(); }
    });
});
