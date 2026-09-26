// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, deferred, Listener, managerFor, table, tick } from '../given/a_manager.js';

describe('when a listener close times out before the socket ends', () => {
    it('should wait for actual closure before starting a new listener and report the deadline', async () => {
        const first = new Listener();
        const ending = deferred<void>();
        first.close = () => { first.closeCount++; return ending.promise; };
        let calls = 0;
        const manager = managerFor(() => { calls++; return calls === 1 ? first : new Listener(); }, 50);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        await lease.ready;
        lease.release();
        const replacement = manager.acquire('tenant', database, table, () => {}, () => {});
        const outcome = replacement.ready.then(() => 'ready', () => 'failed');
        await new Promise<void>(resolve => setTimeout(resolve, 75));
        calls.should.equal(1);
        ending.resolve();
        (await outcome).should.equal('ready');
        calls.should.equal(2);
        replacement.release();
        await tick();
        const failure = await manager[Symbol.asyncDispose]().then(() => undefined, error => error as Error);
        failure!.message.should.include('PostgreSQL listener shutdown failed');
    });
});
