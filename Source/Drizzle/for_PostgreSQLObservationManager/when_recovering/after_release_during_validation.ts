// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { pgTable, text } from 'drizzle-orm/pg-core';
import { vi } from 'vitest';
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';
import { database, deferred, Listener, row, table } from '../given/a_manager.js';

describe('when a lease is released during recovery trigger validation', () => {
    it('should not restore its deleted table identity', async () => {
        const otherTable = pgTable('other_tasks', { id: text('id').primaryKey() });
        const original = { execute: async () => [{ ...row, oid: '13', key: 'app.other_tasks' }] } as DrizzleDatabase;
        const replacement = { execute: async () => [{ ...row, oid: '14', key: 'app.replacement' }] } as DrizzleDatabase;
        const first = new Listener();
        const second = new Listener();
        const validation = deferred<void>();
        const query = second.query.bind(second);
        let validating = false;
        second.query = async (statement, values) => {
            if (statement.includes('pg_trigger') && values?.[0] === '13') {
                validating = true;
                await validation.promise;
            }
            return query(statement, values);
        };
        let calls = 0;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => ++calls === 1 ? first : second }, 60_000, 100, [1]);
        let recovered = false;
        const good = manager.acquire('tenant', database, table, forced => { if (forced) recovered = true; }, () => {});
        const released = manager.acquire('tenant', original, otherTable, () => {}, () => {});
        try {
            await Promise.all([good.ready, released.ready]);
            first.disconnect?.();
            await vi.waitFor(() => validating.should.equal(true));
            released.release();
            validation.resolve();
            await vi.waitFor(() => recovered.should.equal(true));
            const newLease = manager.acquire('tenant', replacement, otherTable, () => {}, () => {});
            await newLease.ready;
            newLease.release();
        } finally { validation.resolve(); released.release(); good.release(); await manager[Symbol.asyncDispose](); }
    });
});
