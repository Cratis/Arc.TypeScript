// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';
import { DefinitivePostgreSQLObservationError } from '../../PostgreSQLTableIdentity.js';
import { database, Listener, managerFor, table } from '../given/a_manager.js';

describe('when inspecting the PostgreSQL trigger fails', () => {
    it('should not mislabel a non-permission error as a catalog permission failure', async () => {
        const client = new Listener();
        const query = client.query.bind(client);
        client.query = async statement => {
            if (statement.includes('pg_trigger')) throw Object.assign(new Error('statement timeout'), { code: '57014' });
            return query(statement);
        };
        const manager = managerFor(() => client);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        const error = await lease.ready.then(() => undefined, cause => cause as Error);
        error!.message.should.not.include('catalog permissions');
        (error!.cause as { code: string }).code.should.equal('57014');
        await manager[Symbol.asyncDispose]();
    });
    it('should recommend checking catalog permissions only for SQLSTATE 42501', async () => {
        const client = new Listener();
        const query = client.query.bind(client);
        client.query = async statement => {
            if (statement.includes('pg_trigger')) throw Object.assign(new Error('permission denied'), { code: '42501' });
            return query(statement);
        };
        const manager = managerFor(() => client);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        const error = await lease.ready.then(() => undefined, cause => cause as Error);
        error!.message.should.include('check catalog permissions');
        await manager[Symbol.asyncDispose]();
    });
    it('should report a reader permission failure as definitive', async () => {
        const cause = Object.assign(new Error('permission denied for schema app'), { code: '42501' });
        const reader = { execute: () => Promise.reject(cause) } as DrizzleDatabase;
        const manager = managerFor(() => new Listener());
        const lease = manager.acquire('tenant', reader, table, () => {}, () => {});
        const error = await lease.ready.then(() => undefined, failure => failure as Error);
        error!.should.be.instanceOf(DefinitivePostgreSQLObservationError);
        error!.message.should.include("check the reader's catalog and schema permissions");
        error!.cause!.should.equal(cause);
        await manager[Symbol.asyncDispose]();
    });
});
