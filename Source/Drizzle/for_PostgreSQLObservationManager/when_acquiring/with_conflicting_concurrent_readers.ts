// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { deferred, Listener, managerFor, row, table } from '../given/a_manager.js';
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';

describe('when concurrent scopes resolve one table differently', () => {
    it('should reject the conflicting lease instead of replacing the first identity', async () => {
        const client = new Listener();
        const validation = deferred<void>();
        const query = client.query.bind(client);
        let validations = 0;
        client.query = async statement => {
            if (statement.includes('pg_trigger') && ++validations === 1) await validation.promise;
            return query(statement);
        };
        const manager = managerFor(() => client);
        const reader = (identity: typeof row) => ({ execute: async () => [identity] }) as DrizzleDatabase;
        const first = manager.acquire('tenant', reader(row), table, () => {}, () => {});
        const conflicting = manager.acquire('tenant', reader({ ...row, key: 'other.tasks' }), table, () => {}, () => {});
        await conflicting.ready;
        validation.resolve();
        const error = await first.ready.then(() => undefined, cause => cause as Error);
        error!.message.should.include('mapping differs');
        const matching = manager.acquire('tenant', reader({ ...row, key: 'other.tasks' }), table, () => {}, () => {});
        await matching.ready;
        first.release(); conflicting.release(); matching.release();
        await manager[Symbol.asyncDispose]();
    });
});
