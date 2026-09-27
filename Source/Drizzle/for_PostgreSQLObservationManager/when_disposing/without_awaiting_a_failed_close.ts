// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { database, deferred, Listener, managerFor, table } from '../given/a_manager.js';

describe('when disposal is not awaited immediately and a listener close fails', () => {
    it('should retain the failure for an awaiting caller without an unhandled rejection', async () => {
        const client = new Listener();
        const started = deferred<void>();
        const ending = deferred<void>();
        client.close = () => { client.closeCount++; started.resolve(); return ending.promise; };
        const manager = managerFor(() => client, 50);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        await lease.ready;
        vi.useFakeTimers();
        try {
            // Simulate a fire-and-forget disposal; attach the caller's handler only after the failure.
            void manager[Symbol.asyncDispose]();
            await started.promise;
            ending.reject(new Error('close failed'));
            await vi.advanceTimersByTimeAsync(0);
            vi.useRealTimers();
            await new Promise<void>(resolve => setImmediate(resolve));
            const error = await manager[Symbol.asyncDispose]().then(() => undefined, cause => cause as AggregateError);
            error!.errors.should.have.lengthOf(1);
            (error!.errors[0] as Error).message.should.equal('close failed');
            client.closeCount.should.equal(1);
        } finally { vi.useRealTimers(); }
    });
});
