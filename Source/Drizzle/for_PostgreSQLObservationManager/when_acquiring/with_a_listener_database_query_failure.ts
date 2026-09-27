// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, Listener, managerFor, table } from '../given/a_manager.js';

describe('when verifying the listener database fails', () => {
    it('should fail the lease with an Arc message and keep the driver error only as its cause', async () => {
        const client = new Listener();
        const query = client.query.bind(client);
        const driverError = new Error('password authentication failed for user "secret-user"');
        client.query = async statement => {
            if (statement.includes('current_database')) throw driverError;
            return query(statement);
        };
        const manager = managerFor(() => client);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        const error = await lease.ready.then(() => undefined, cause => cause as Error);
        error!.message.should.include('could not verify the listener database');
        error!.message.should.not.include('secret-user');
        (error!.cause as Error).should.equal(driverError);
        await manager[Symbol.asyncDispose]();
    });
});
