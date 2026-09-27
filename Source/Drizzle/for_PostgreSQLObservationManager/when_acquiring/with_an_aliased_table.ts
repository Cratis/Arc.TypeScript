// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { alias } from 'drizzle-orm/pg-core';
import { database, Listener, managerFor, table } from '../given/a_manager.js';

describe('when observing an aliased PostgreSQL table', () => {
    it('should reject the alias before catalog lookup', async () => {
        let lookups = 0;
        const manager = managerFor(() => new Listener());
        const lease = manager.acquire('tenant', { ...database, execute: async () => { lookups++; return []; } },
            alias(table, 'other_tasks'), () => {}, () => {});
        const error = await lease.ready.then(() => undefined, cause => cause as Error);
        error!.message.should.include('aliased');
        lookups.should.equal(0);
        await manager[Symbol.asyncDispose]();
    });
});
