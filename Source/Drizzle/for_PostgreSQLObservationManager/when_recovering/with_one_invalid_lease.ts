// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { pgTable, text } from 'drizzle-orm/pg-core';
import { vi } from 'vitest';
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';
import type { DrizzleObservationLease } from '../../DrizzleObservationLease.js';
import { database, Listener, row, table } from '../given/a_manager.js';

const otherTable = pgTable('other_tasks', { id: text('id').primaryKey() });
const otherRow = { ...row, oid: '13', key: 'app.other_tasks' };
const otherDatabase = { execute: async () => [otherRow] } as DrizzleDatabase;

describe('when one lease changes while a shared listener recovers', () => {
    for (const state of ['missing', 'disabled'] as const) {
        it(`should fail only the affected lease if its trigger is ${state}`, async () => {
            const first = new Listener();
            const next = new Listener();
            const query = next.query.bind(next);
            next.query = async (statement, parameters) => {
                if (statement.includes('pg_trigger') && parameters?.[0] === '13') {
                    if (state === 'missing') return { rows: [] };
                    const result = await query(statement, parameters);
                    return { rows: [{ ...result.rows[0], tgenabled: 'D' }] };
                }
                return query(statement, parameters);
            };
            let calls = 0;
            const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
                listener: () => ++calls === 1 ? first : next }, 60_000, 100, [1]);
            const failures: Error[] = [];
            const updates: string[] = [];
            const good = manager.acquire('tenant', database, table, forced => { if (forced) updates.push('good'); }, error => failures.push(error));
            const bad: DrizzleObservationLease = manager.acquire('tenant', otherDatabase, otherTable, forced => { if (forced) updates.push('bad'); },
                error => { failures.push(error); bad.release(); });
            try {
                await Promise.all([good.ready, bad.ready]);
                first.disconnect?.();
                await vi.waitFor(() => updates.should.deep.equal(['good']));
                failures.should.have.lengthOf(1);
                failures[0]!.message.should.include(`trigger invalid for 'app.other_tasks': ${state}`);
                next.notification?.('arc_changes', 'app.tasks');
                failures.should.have.lengthOf(1);
            } finally { good.release(); bad.release(); await manager[Symbol.asyncDispose](); }
        });
    }

    it('should fail only the affected lease when its reader resolves a different table', async () => {
        const first = new Listener();
        const next = new Listener();
        let mapped = otherRow;
        const changingReader = { execute: async () => [mapped] } as DrizzleDatabase;
        let calls = 0;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => ++calls === 1 ? first : next }, 60_000, 100, [1]);
        const failures: Error[] = [];
        const updates: string[] = [];
        const good = manager.acquire('tenant', database, table, forced => { if (forced) updates.push('good'); }, error => failures.push(error));
        const bad: DrizzleObservationLease = manager.acquire('tenant', changingReader, otherTable, forced => { if (forced) updates.push('bad'); },
            error => { failures.push(error); bad.release(); });
        try {
            await Promise.all([good.ready, bad.ready]);
            mapped = { ...otherRow, key: 'other.other_tasks' };
            first.disconnect?.();
            await vi.waitFor(() => updates.should.deep.equal(['good']));
            failures.should.have.lengthOf(1);
            failures[0]!.message.should.include('mapping differs');
        } finally { good.release(); bad.release(); await manager[Symbol.asyncDispose](); }
    });
});
