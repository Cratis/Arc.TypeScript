// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, deferred, Listener, managerFor, row, table } from '../given/a_manager.js';
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';

describe('when a database-wide notification burst arrives during one acquisition', () => {
    it('should ignore more than 256 unrelated tables without failing active subscriptions', async () => {
        const client = new Listener();
        const manager = managerFor(() => client);
        const failures: Error[] = [];
        let changes = 0;
        const active = manager.acquire('tenant', database, table, () => { changes++; }, error => failures.push(error));
        await active.ready;
        const lookup = deferred<typeof row[]>();
        const reader = { execute: () => lookup.promise } as DrizzleDatabase;
        const acquiring = manager.acquire('tenant', reader, table, () => {}, error => failures.push(error));
        for (let index = 0; index < 257; index++) client.notification?.('arc_changes', `other.table_${index}`);
        lookup.resolve([row]);
        await acquiring.ready;
        client.notification?.('arc_changes', 'app.tasks');
        failures.should.have.lengthOf(0);
        changes.should.equal(1);
        acquiring.release(); active.release();
        await manager[Symbol.asyncDispose]();
    });
});
