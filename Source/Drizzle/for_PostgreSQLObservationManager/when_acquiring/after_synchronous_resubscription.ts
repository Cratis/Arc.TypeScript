// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, Listener, managerFor, table } from '../given/a_manager.js';

describe('when a subscriber resubscribes synchronously on listener failure', () => {
    it('should route the new lease to a fresh entry, not the dying listener', async () => {
        const first = new Listener();
        const next = new Listener();
        let calls = 0;
        const manager = managerFor(() => ++calls === 1 ? first : next);
        let retry: ReturnType<typeof manager.acquire> | undefined;
        let failures = 0;
        const onFailure = () => {
            failures++;
            if (!retry) retry = manager.acquire('tenant', database, table, () => {}, () => {});
        };
        const a = manager.acquire('tenant', database, table, () => {}, onFailure);
        const b = manager.acquire('tenant', database, table, () => {}, onFailure);
        await Promise.all([a.ready, b.ready]);
        first.disconnect?.(new Error('lost'));
        await retry!.ready;
        failures.should.equal(2);
        calls.should.equal(2);
        a.release(); b.release(); retry!.release();
        await manager[Symbol.asyncDispose]();
    });
});
