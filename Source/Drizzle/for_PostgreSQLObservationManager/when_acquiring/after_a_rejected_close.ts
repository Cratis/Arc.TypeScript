// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, Listener, managerFor, table, tick } from '../given/a_manager.js';

describe('when acquiring after a rejected listener close', () => {
    it('should start a fresh listener and retain the close failure for disposal', async () => {
        const first = new Listener();
        first.close = async () => { first.closeCount++; throw new Error('close failed'); };
        const next = new Listener();
        let calls = 0;
        const manager = managerFor(() => ++calls === 1 ? first : next);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        await lease.ready;
        lease.release();
        await tick();
        const replacement = manager.acquire('tenant', database, table, () => {}, () => {});
        await replacement.ready;
        calls.should.equal(2);
        replacement.release();
        const failure = await manager[Symbol.asyncDispose]().then(() => undefined, error => error as Error);
        failure!.message.should.include('PostgreSQL listener shutdown failed');
    });
});
