// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, deferred, Listener, managerFor, row, table } from '../given/a_manager.js';
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';

describe('when unrelated notifications arrive during acquisitions', () => {
    it('should keep the existing lease alive across successive acquisition windows', async () => {
        const client = new Listener();
        const manager = managerFor(() => client);
        const failures: Error[] = [];
        const active = manager.acquire('tenant', database, table, () => {}, error => failures.push(error));
        await active.ready;
        for (let batch = 0; batch < 3; batch++) {
            const lookup = deferred<typeof row[]>();
            const reader = { execute: () => lookup.promise } as DrizzleDatabase;
            const acquiring = manager.acquire('tenant', reader, table, () => {}, error => failures.push(error));
            for (let index = 0; index < 100; index++) client.notification?.('arc_changes', `foreign_${batch}.table_${index}`);
            lookup.resolve([row]);
            await acquiring.ready;
            acquiring.release();
        }
        failures.should.have.lengthOf(0);
        client.notification?.('arc_changes', 'app.tasks');
        active.release();
        await manager[Symbol.asyncDispose]();
    });
});
