// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, Listener, managerFor, table } from '../given/a_manager.js';

describe('when acquiring with an incompatible PostgreSQL trigger', () => {
    for (const [reason, changes] of [
        ['disabled', { tgenabled: 'D' }],
        ['events', { tgtype: 61 }],
        ['events', { no_predicate: false }],
        ['events', { attributes: '1' }],
        ['events', { tgisinternal: true }],
        ['events', { constraint_oid: '2' }],
        ['function version', { proname: 'old_notify' }],
        ['function version', { function_schema: 'other' }],
        ['function version', { pronargs: 1 }],
        ['function version', { returns_trigger: false }],
        ['function version', { lanname: 'sql' }],
        ['channel', { tgnargs: 2 }],
        ['channel', { arguments: '' }]
    ] as [string, Record<string, unknown>][]) {
        it(`should reject ${Object.keys(changes)[0]} as ${reason}`, async () => {
            const listener = new Listener();
            const query = listener.query.bind(listener);
            listener.query = async statement => {
                const result = await query(statement);
                return statement.includes('pg_trigger') ? { rows: [{ ...result.rows[0], ...changes }] } : result;
            };
            const manager = managerFor(() => listener);
            const lease = manager.acquire('tenant', database, table, () => {}, () => {});
            try {
                await lease.ready.should.be.rejectedWith(`PostgreSQL observation trigger invalid for 'app.tasks': ${reason}; apply postgresqlChangeTrigger(...) through an application migration`);
                listener.closeCount.should.equal(1);
            } finally { lease.release(); await manager[Symbol.asyncDispose](); }
        });
    }

    it('should accept an always enabled trigger and release its routing only once', async () => {
        const listener = new Listener();
        const query = listener.query.bind(listener);
        listener.query = async statement => {
            const result = await query(statement);
            return statement.includes('pg_trigger') ? { rows: [{ ...result.rows[0], tgenabled: 'A' }] } : result;
        };
        const manager = managerFor(() => listener);
        const changes: string[] = [];
        const first = manager.acquire('tenant', database, table, () => changes.push('first'), () => {});
        const second = manager.acquire('tenant', database, table, () => changes.push('second'), () => {});
        try {
            await Promise.all([first.ready, second.ready]);
            first.release();
            first.release();
            listener.notification?.('arc_changes', 'app.tasks');
            changes.should.deep.equal(['second']);
            listener.closeCount.should.equal(0);
        } finally { first.release(); second.release(); await manager[Symbol.asyncDispose](); }
    });
});
