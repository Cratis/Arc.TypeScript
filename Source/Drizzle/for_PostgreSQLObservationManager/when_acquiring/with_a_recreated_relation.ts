// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, Listener, managerFor, row, table } from '../given/a_manager.js';
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';

describe('when the observed relation is recreated at the same canonical name', () => {
    it('should accept the new OID for the same database and canonical key', async () => {
        const manager = managerFor(() => new Listener());
        const first = manager.acquire('tenant', database, table, () => {}, () => {});
        await first.ready;
        const recreated = manager.acquire('tenant', { execute: async () => [{ ...row, oid: '13' }] } as DrizzleDatabase,
            table, () => {}, () => {});
        await recreated.ready;
        first.release(); recreated.release();
        await manager[Symbol.asyncDispose]();
    });
});
