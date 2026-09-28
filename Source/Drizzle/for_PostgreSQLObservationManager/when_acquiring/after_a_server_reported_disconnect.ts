// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, Listener, managerFor, table } from '../given/a_manager.js';

describe('when the server reports a fatal error on the listener connection', () => {
    it('should report a connection failure rather than a closed connection', async () => {
        const client = new Listener();
        const manager = managerFor(() => client);
        let failure: Error | undefined;
        const lease = manager.acquire('tenant', database, table, () => {}, error => { failure = error; });
        await lease.ready;
        // node-postgres names server-reported protocol errors 'error', in lowercase.
        client.disconnect!(Object.assign(new Error('terminating connection due to administrator command'), { name: 'error' }));
        failure!.message.should.equal('PostgreSQL change listener lost: connection failure');
        await manager[Symbol.asyncDispose]();
    });
});
