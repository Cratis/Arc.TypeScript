// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DrizzleDialect } from '../../DrizzleDialect.js';
import { describe, it, should } from 'vitest';
import { eq } from 'drizzle-orm';
import { ArcApplication, Severity } from '@cratis/arc.core';
import { given } from '../../given.js';
import { drizzleDatabase, drizzleReadModel } from '../../index.js';
import { TaskRecord } from '../given/TaskRecord.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';

should();
describe('when paging across tenants', given(a_sqlite_database, context => {
    it('should use the tenant-specific connection and isolate scoped read models', async () => {
        const builder = ArcApplication.createBuilder();
        await context.establish();
        const other = new a_sqlite_database();
        await other.establish();
        other.database.delete(other.table).run();
        builder.withDrizzle({ dialect: DrizzleDialect.SQLite, databaseFactory: tenant => tenant === 'a' ? context.database : other.database,
            readModels: [{ type: TaskRecord, table: context.table }] });
        const app = await builder.build();
        const identity = (tenantId: string) => ({ tenantId, principal: undefined, allowedSeverity: Severity.Warning,
            signal: new AbortController().signal, correlationId: crypto.randomUUID() });
        const a = app.server.services.createScope(identity('a'));
        const b = app.server.services.createScope(identity('b'));
        try {
            const first = await a.resolve(drizzleReadModel(TaskRecord));
            const second = await b.resolve(drizzleReadModel(TaskRecord));
            (await first.queryPage(eq(context.table.title, 'a'), { paging: { page: 0, pageSize: 1 } })).totalItems.should.equal(1);
            (await second.queryPage(undefined, { paging: { page: 0, pageSize: 1 } })).totalItems.should.equal(0);
            (await a.resolve(drizzleDatabase())).native.should.equal(context.database);
        } finally { await a.dispose(); await b.dispose(); await app.dispose(); other.close(); context.close(); }
    });
}));
