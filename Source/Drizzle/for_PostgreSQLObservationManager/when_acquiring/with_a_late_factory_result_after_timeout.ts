// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { database, deferred, Listener, managerFor, table } from '../given/a_manager.js';

describe('when a factory returns a connection after its deadline', () => {
    it('should close the late result and include its shutdown in disposal', async () => {
        const factory = deferred<Listener>();
        const client = new Listener();
        const ending = deferred<void>();
        const closeStarted = deferred<void>();
        client.close = () => { client.closeCount++; closeStarted.resolve(); return ending.promise; };
        const manager = managerFor(() => factory.promise, 100);
        vi.useFakeTimers();
        try {
            const lease = manager.acquire('tenant', database, table, () => {}, () => {});
            const failure = lease.ready.then(() => undefined, cause => cause as Error);
            await vi.advanceTimersByTimeAsync(100);
            const error = await failure;
            error!.message.should.include('could not start');
            factory.resolve(client);
            await closeStarted.promise;
            client.closeCount.should.equal(1);
            let disposed = false;
            const disposal = manager[Symbol.asyncDispose]().then(() => { disposed = true; });
            await vi.advanceTimersByTimeAsync(0);
            disposed.should.equal(false);
            ending.resolve();
            await disposal;
            disposed.should.equal(true);
        } finally { vi.useRealTimers(); }
    });
});
