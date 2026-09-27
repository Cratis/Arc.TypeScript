// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, deferred, Listener, managerFor, table } from '../given/a_manager.js';

describe('when disposing with a rejected factory result still closing', () => {
    it('should await and report that close before disposal finishes', async () => {
        const client = Object.assign(new Listener(), { release: () => {} });
        const ending = deferred<void>();
        const closeStarted = deferred<void>();
        client.close = () => { client.closeCount++; closeStarted.resolve(); return ending.promise; };
        const manager = managerFor(() => client, 60_000); // The close deadline is not under test here.
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        await lease.ready.then(() => {}, () => {});
        let disposed = false;
        const disposal = manager[Symbol.asyncDispose]().then(() => { disposed = true; });
        await closeStarted.promise;
        await new Promise<void>(resolve => setImmediate(resolve));
        disposed.should.equal(false);
        client.closeCount.should.equal(1);
        ending.resolve();
        await disposal;
        disposed.should.equal(true);
    });
});
