// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, Listener, managerFor, table } from '../given/a_manager.js';

describe('when a listener close never settles', () => {
    it('should fail a waiting acquisition within the operation timeout, open no other listener and report the close deadline', async () => {
        const first = new Listener();
        first.close = () => { first.closeCount++; return new Promise<void>(() => {}); };
        let calls = 0;
        const manager = managerFor(() => { calls++; return calls === 1 ? first : new Listener(); }, 20);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        await lease.ready;
        lease.release();
        const replacement = manager.acquire('tenant', database, table, () => {}, () => {});
        const outcome = await Promise.race([
            replacement.ready.then(() => 'ready', (error: Error) => error.message),
            new Promise<string>(resolve => setTimeout(() => resolve('pending'), 200))
        ]);
        outcome.should.include('could not start');
        calls.should.equal(1);
        const failure = await manager[Symbol.asyncDispose]().then(() => undefined, error => error as Error);
        failure!.message.should.include('PostgreSQL listener shutdown failed');
    });
});
