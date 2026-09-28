// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { pgTable, text } from 'drizzle-orm/pg-core';
import { vi } from 'vitest';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';
import type { PostgreSQLListenerConnection } from '../../PostgreSQLListenerConnection.js';
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';

const table = pgTable('tasks', { id: text('id').primaryKey() });
const database = { execute: async () => [{ oid: '12', key: 'app.tasks', database: 'arc', kind: 'r', schema: 'app' }] } as DrizzleDatabase;

class FakeListener implements PostgreSQLListenerConnection {
    readonly queries: string[] = [];
    closeCount = 0;
    connected = 0;
    notification?: (channel: string, payload?: string) => void;
    disconnect?: (error?: Error) => void;
    async connect(): Promise<void> { this.connected++; }
    async query(statement: string): Promise<{ rows: Record<string, unknown>[] }> {
        this.queries.push(statement);
        if (statement.includes('current_database')) return { rows: [{ database: 'arc' }] };
        if (statement.includes('pg_trigger')) return { rows: [{ tgtype: 60, tgenabled: 'O', no_predicate: true,
            attributes: '', tgisinternal: false, constraint_oid: '0', tgnargs: 1,
            arguments: '6172635f6368616e67657300', proname: 'arc_notify_changes_v1', pronargs: 0,
            returns_trigger: true, lanname: 'plpgsql', function_schema: 'app' }] };
        return { rows: [] };
    }
    onNotification(listener: (channel: string, payload?: string) => void): void { this.notification = listener; }
    onDisconnect(listener: (error?: Error) => void): void { this.disconnect = listener; }
    async close(): Promise<void> { this.closeCount++; }
}

describe('when acquiring shared PostgreSQL observation leases', () => {
    let client: FakeListener;
    let manager: PostgreSQLObservationManager;
    let changes: number;
    let failures: Error[];
    beforeEach(() => {
        client = new FakeListener(); changes = 0; failures = [];
        manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify, listener: () => client }, 30_000, 5_000, []);
    });
    afterEach(async () => { await manager[Symbol.asyncDispose](); });
    it('should connect once, listen before catalog validation, ignore unknown payloads and share the socket', async () => {
        const first = manager.acquire('tenant', database, table, () => { changes++; }, error => failures.push(error));
        const second = manager.acquire('tenant', database, table, () => { changes++; }, error => failures.push(error));
        try {
            await Promise.all([first.ready, second.ready]);
            client.connected.should.equal(1);
            client.queries[0]!.should.equal('LISTEN "arc_changes"');
            client.queries.some(query => query.includes('BEGIN')).should.equal(false);
            client.notification?.('arc_changes', 'other.tasks');
            changes.should.equal(0);
            client.notification?.('arc_changes', 'app.tasks');
            changes.should.equal(2);
            first.release();
            client.closeCount.should.equal(0);
            second.release();
            await manager[Symbol.asyncDispose]();
            client.closeCount.should.equal(1);
        } finally { first.release(); second.release(); }
    });
    it('should report a heartbeat transport failure once to all leases', async () => {
        const query = client.query.bind(client);
        client.query = async statement => {
            if (statement === 'SELECT 1') throw new Error('private network address');
            return query(statement);
        };
        manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => client }, 1, 100, []);
        vi.useFakeTimers();
        try {
            const lease = manager.acquire('tenant', database, table, () => {}, error => failures.push(error));
            await lease.ready;
            await vi.advanceTimersByTimeAsync(1);
            failures.should.have.lengthOf(1);
            failures[0]!.message.should.include('recovery exhausted');
            lease.release();
        } finally { vi.useRealTimers(); }
    });
    it('should cancel acquisition on last release and end a late factory result', async () => {
        let provide!: (connection: FakeListener) => void;
        const pending = new Promise<FakeListener>(resolve => { provide = resolve; });
        let closed!: () => void;
        const closing = new Promise<void>(resolve => { closed = resolve; });
        client.close = async () => { client.closeCount++; closed(); };
        manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify, listener: () => pending });
        const lease = manager.acquire('tenant', database, table, () => {}, error => failures.push(error));
        lease.release();
        const result = await lease.ready.then(() => 'ready', () => 'canceled');
        result.should.equal('canceled');
        provide(client);
        await closing;
        client.closeCount.should.equal(1);
        client.connected.should.equal(0);
    });
    it('should deliver one terminal failure to every lease for an error followed by end', async () => {
        const first = manager.acquire('tenant', database, table, () => {}, error => failures.push(error));
        const second = manager.acquire('tenant', database, table, () => {}, error => failures.push(error));
        await Promise.all([first.ready, second.ready]);
        client.disconnect?.(new Error('secret credential in driver message'));
        client.disconnect?.();
        await vi.waitFor(() => failures.length.should.equal(2));
        failures[0]!.message.should.include('PostgreSQL change listener lost');
        failures[0]!.message.should.not.include('secret credential');
        first.release(); second.release();
    });
});
