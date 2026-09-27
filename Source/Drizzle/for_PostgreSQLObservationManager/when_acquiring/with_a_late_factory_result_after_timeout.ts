// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, deferred, Listener, managerFor, table, tick } from '../given/a_manager.js';

describe('when a factory returns a connection after its deadline', () => {
    it('should close the late result and include its shutdown in disposal', async () => {
        const factory = deferred<Listener>();
        const client = new Listener();
        const ending = deferred<void>();
        client.close = () => { client.closeCount++; return ending.promise; };
        const manager = managerFor(() => factory.promise, 100);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        const error = await lease.ready.then(() => undefined, cause => cause as Error);
        error!.message.should.include('could not start');
        factory.resolve(client);
        await tick();
        client.closeCount.should.equal(1);
        let disposed = false;
        const disposal = manager[Symbol.asyncDispose]().then(() => { disposed = true; });
        await tick();
        disposed.should.equal(false);
        ending.resolve();
        await disposal;
        disposed.should.equal(true);
    });
});
