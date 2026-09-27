// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, deferred, Listener, managerFor, table } from '../given/a_manager.js';

describe('when disposing after a listener close failed', () => {
    it('should report prior close failures once across repeated disposal calls', async () => {
        const client = new Listener();
        const closeStarted = deferred<void>();
        client.close = async () => { closeStarted.resolve(); throw new Error('close failed'); };
        const manager = managerFor(() => client);
        const lease = manager.acquire('tenant', database, table, () => {}, () => {});
        await lease.ready;
        lease.release();
        await closeStarted.promise;
        await new Promise<void>(resolve => setImmediate(resolve));
        const dispose = manager[Symbol.asyncDispose]();
        const again = manager[Symbol.asyncDispose]();
        (dispose === again).should.equal(true);
        const error = await dispose.then(() => undefined, cause => cause as AggregateError);
        error!.errors.should.have.lengthOf(1);
        await again.catch(() => {});
    });
    it('should bound retained failures while reporting the overflow at disposal', async () => {
        let closeStarted = deferred<void>();
        const manager = managerFor(() => {
            const client = new Listener();
            client.close = async () => { closeStarted.resolve(); throw new Error('close failed'); };
            return client;
        });
        for (let index = 0; index < 34; index++) {
            const lease = manager.acquire('tenant', database, table, () => {}, () => {});
            await lease.ready;
            lease.release();
            await closeStarted.promise;
            closeStarted = deferred<void>();
        }
        const error = await manager[Symbol.asyncDispose]().then(() => undefined, cause => cause as AggregateError);
        error!.errors.should.have.lengthOf(33);
        (error!.errors.at(-1) as Error).message.should.include('2 additional');
    });
});
