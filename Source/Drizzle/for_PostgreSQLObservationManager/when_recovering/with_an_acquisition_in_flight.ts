// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';
import { database, deferred, Listener, row, table } from '../given/a_manager.js';

describe('when a listener is lost while a new lease is being acquired', () => {
    it('should retry an interrupted reader lookup after reconnecting', async () => {
        const first = new Listener();
        const next = new Listener();
        const lookup = deferred<typeof row[]>();
        let lookups = 0;
        let calls = 0;
        const reader = { execute: () => ++lookups === 1 ? lookup.promise : Promise.resolve([row]) } as DrizzleDatabase;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => ++calls === 1 ? first : next }, 60_000, 100, [1]);
        const failures: Error[] = [];
        const existing = manager.acquire('tenant', database, table, () => {}, error => failures.push(error));
        try {
            await existing.ready;
            const joining = manager.acquire('tenant', reader, table, () => {}, error => failures.push(error));
            await vi.waitFor(() => lookups.should.equal(1));
            first.disconnect?.();
            await joining.ready;
            lookups.should.equal(2);
            failures.should.have.lengthOf(0);
            lookup.resolve([row]);
            next.notification?.('arc_changes', 'app.tasks');
            joining.release();
        } finally { lookup.resolve([row]); existing.release(); await manager[Symbol.asyncDispose](); }
    });

    it('should fail an interrupted acquisition only after recovery is exhausted', async () => {
        const first = new Listener();
        const lookup = deferred<typeof row[]>();
        let lookups = 0;
        let calls = 0;
        const reader = { execute: () => { lookups++; return lookup.promise; } } as DrizzleDatabase;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => { if (++calls === 1) return first; throw new Error('unavailable'); } }, 60_000, 100, [1]);
        const existing = manager.acquire('tenant', database, table, () => {}, () => {});
        try {
            await existing.ready;
            const joining = manager.acquire('tenant', reader, table, () => {}, () => {});
            await vi.waitFor(() => lookups.should.equal(1));
            first.disconnect?.();
            const failure = await joining.ready.then(() => undefined, error => error as Error);
            failure!.message.should.include('recovery exhausted');
            calls.should.equal(2);
        } finally { lookup.resolve([row]); existing.release(); await manager[Symbol.asyncDispose](); }
    });

    it('should retry when listener validation is interrupted by a disconnect', async () => {
        const first = new Listener();
        const next = new Listener();
        const check = deferred<{ rows: Record<string, unknown>[] }>();
        const query = first.query.bind(first);
        let checks = 0;
        first.query = async statement => {
            if (statement.includes('current_database') && ++checks === 2) return check.promise;
            return query(statement);
        };
        let calls = 0;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => ++calls === 1 ? first : next }, 60_000, 100, [1]);
        const failures: Error[] = [];
        const existing = manager.acquire('tenant', database, table, () => {}, error => failures.push(error));
        try {
            await existing.ready;
            const joining = manager.acquire('tenant', database, table, () => {}, error => failures.push(error));
            await vi.waitFor(() => checks.should.equal(2));
            first.disconnect?.();
            await joining.ready;
            failures.should.have.lengthOf(0);
            check.reject(new Error('old socket closed'));
            joining.release();
        } finally { check.resolve({ rows: [{ database: 'arc' }] }); existing.release(); await manager[Symbol.asyncDispose](); }
    });
});
