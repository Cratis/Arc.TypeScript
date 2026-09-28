// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { database, deferred, Listener, table } from '../given/a_manager.js';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';

describe('when recovering a shared PostgreSQL listener', () => {
    it('should pause new leases and force every live lease to catch up after LISTEN and validation', async () => {
        const first = new Listener();
        const next = new Listener();
        const gate = deferred<void>();
        const query = next.query.bind(next);
        next.query = async statement => {
            if (statement.startsWith('LISTEN')) await gate.promise;
            return query(statement);
        };
        let calls = 0;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => ++calls === 1 ? first : next }, 60_000, 100, [1]);
        const updates: string[] = [];
        const failures: Error[] = [];
        const one = manager.acquire('tenant', database, table, forced => { if (forced) updates.push('one'); }, error => failures.push(error));
        const two = manager.acquire('tenant', database, table, forced => { if (forced) updates.push('two'); }, error => failures.push(error));
        try {
            await Promise.all([one.ready, two.ready]);
            first.disconnect?.(new Error('secret'));
            const joining = manager.acquire('tenant', database, table, forced => { if (forced) updates.push('joining'); }, error => failures.push(error));
            let admitted = false;
            void joining.ready.then(() => { admitted = true; });
            await vi.waitFor(() => calls.should.equal(2));
            admitted.should.equal(false);
            updates.should.be.empty;
            gate.resolve();
            await joining.ready;
            await vi.waitFor(() => updates.should.have.members(['one', 'two']));
            next.notification?.('arc_changes', 'app.tasks');
            failures.should.be.empty;
            joining.release();
        } finally { one.release(); two.release(); gate.resolve(); await manager[Symbol.asyncDispose](); }
    });
});
