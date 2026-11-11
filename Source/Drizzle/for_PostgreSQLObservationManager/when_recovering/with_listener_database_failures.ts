// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';
import { database, Listener, table } from '../given/a_manager.js';

describe('when verifying the listener database during PostgreSQL recovery', () => {
    it('should spend a retry on a query failure and catch up on the next listener', async () => {
        const listeners = [new Listener(), new Listener(), new Listener()];
        const query = listeners[1]!.query.bind(listeners[1]);
        listeners[1]!.query = async statement => {
            if (statement.includes('current_database')) throw new Error('connection unavailable');
            return query(statement);
        };
        let connections = 0;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => listeners[connections++]! }, 60_000, 100, [1, 1]);
        const changes: boolean[] = [];
        const failures: Error[] = [];
        const lease = manager.acquire('tenant', database, table, forced => changes.push(forced ?? false), error => failures.push(error));
        try {
            await lease.ready;
            listeners[0]!.disconnect?.();
            await vi.waitFor(() => changes.should.deep.equal([true]));
            connections.should.equal(3);
            failures.should.have.lengthOf(0);
            listeners[1]!.closeCount.should.equal(1);
        } finally { lease.release(); await manager[Symbol.asyncDispose](); }
    });

    it('should fail the lease definitively when the listener database differs', async () => {
        const first = new Listener();
        const next = new Listener();
        const query = next.query.bind(next);
        next.query = async statement => statement.includes('current_database') ? { rows: [{ database: 'other' }] } : query(statement);
        let connections = 0;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => ++connections === 1 ? first : next }, 60_000, 100, [1]);
        const failures: Error[] = [];
        const lease = manager.acquire('tenant', database, table, () => {}, error => failures.push(error));
        try {
            await lease.ready;
            first.disconnect?.();
            await vi.waitFor(() => failures.should.have.lengthOf(1));
            failures[0]!.message.should.equal("PostgreSQL observation database/table mapping differs between reader and listener for tenant 'tenant'");
            connections.should.equal(2);
        } finally { lease.release(); await manager[Symbol.asyncDispose](); }
    });
});
