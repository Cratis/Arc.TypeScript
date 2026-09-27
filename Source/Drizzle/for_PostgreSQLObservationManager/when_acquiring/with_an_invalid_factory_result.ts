// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, Listener, managerFor, table } from '../given/a_manager.js';

describe('when the listener factory returns a pooled connection', () => {
    it('should close the rejected factory result and account for shutdown', async () => {
        const client = Object.assign(new Listener(), { release: () => {} });
        const manager = managerFor(() => client);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        const error = await lease.ready.then(() => undefined, cause => cause as Error);
        error!.message.should.include('could not start');
        await manager[Symbol.asyncDispose]();
        client.closeCount.should.equal(1);
    });
});
