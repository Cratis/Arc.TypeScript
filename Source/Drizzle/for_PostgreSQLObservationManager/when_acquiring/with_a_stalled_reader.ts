// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, deferred, Listener, managerFor, row, table } from '../given/a_manager.js';
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';

describe('when a reader catalog lookup stalls', () => {
    it('should time out only the acquiring lease without closing the listener', async () => {
        const client = new Listener();
        const manager = managerFor(() => client, 50);
        const failures: Error[] = [];
        const first = manager.acquire('tenant', database, table, () => {}, error => failures.push(error));
        await first.ready;
        const lookup = deferred<typeof row[]>();
        const reader = { execute: () => lookup.promise } as DrizzleDatabase;
        const stalled = manager.acquire('tenant', reader, table, () => {}, error => failures.push(error));
        const failure = await stalled.ready.then(() => undefined, error => error as Error);
        failure!.message.should.include('timed out');
        client.closeCount.should.equal(0);
        failures.should.have.lengthOf(0);
        lookup.resolve([row]);
        const fresh = manager.acquire('tenant', database, table, () => {}, () => {});
        await fresh.ready;
        first.release(); fresh.release();
        await manager[Symbol.asyncDispose]();
    });
});
