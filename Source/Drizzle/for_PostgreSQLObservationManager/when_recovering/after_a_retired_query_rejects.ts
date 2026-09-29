// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';
import { database, deferred, Listener, table } from '../given/a_manager.js';

describe('when a retired recovery query rejects after a replacement becomes available', () => {
    it('should keep the replacement available and deliver its notifications', async () => {
        const original = new Listener();
        const retired = new Listener();
        const replacement = new Listener();
        const query = retired.query.bind(retired);
        const pending = deferred<{ rows: Record<string, unknown>[] }>();
        retired.query = statement => statement.includes('current_database') ? pending.promise : query(statement);
        let connections = 0;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => [original, retired, replacement][connections++]! }, 60_000, 20, [1, 1]);
        const updates: boolean[] = [];
        const failures: Error[] = [];
        const lease = manager.acquire('tenant', database, table, forced => updates.push(forced ?? false), error => failures.push(error));
        try {
            await lease.ready;
            original.disconnect?.();
            await vi.waitFor(() => updates.should.deep.equal([true]));
            connections.should.equal(3);
            pending.reject(new Error('retired database query failed'));
            await new Promise<void>(resolve => setTimeout(resolve, 0));
            replacement.closeCount.should.equal(0);
            failures.should.have.lengthOf(0);
            replacement.notification?.('arc_changes', 'app.tasks');
            updates.should.deep.equal([true, false]);
            await lease.whenReady!();
            connections.should.equal(3);
        } finally { lease.release(); await manager[Symbol.asyncDispose](); }
    });
});
