// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, Listener, managerFor, table } from '../given/a_manager.js';

describe('when an acquisition is released while waiting for a previous close', () => {
    it('should settle promptly without opening another listener', async () => {
        const first = new Listener();
        first.close = () => { first.closeCount++; return new Promise<void>(() => {}); };
        let calls = 0;
        const manager = managerFor(() => { calls++; return calls === 1 ? first : new Listener(); }, 10_000);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        await lease.ready;
        lease.release();
        const replacement = manager.acquire('tenant', database, table, () => {}, () => {});
        replacement.release();
        const outcome = await Promise.race([
            replacement.ready.then(() => 'ready', () => 'failed'),
            new Promise<string>(resolve => setTimeout(() => resolve('pending'), 200))
        ]);
        outcome.should.equal('failed');
        calls.should.equal(1);
    });
});
