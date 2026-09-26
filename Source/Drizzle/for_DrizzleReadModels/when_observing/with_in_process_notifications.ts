// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, Severity, SortDirection } from '@cratis/arc.core';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { eq } from 'drizzle-orm';
import { DrizzleDialect } from '../../DrizzleDialect.js';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { DrizzleChangeNotifications } from '../../DrizzleChangeNotifications.js';
import { DrizzleHandle } from '../../DrizzleHandle.js';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';
import { drizzleDatabase, drizzleReadModel } from '../../drizzleToken.js';
import '../../index.js';
import { TaskRecord } from '../given/TaskRecord.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';

should();
const identity = (tenantId = 'DeFaUlT') => ({ tenantId, principal: undefined, allowedSeverity: Severity.Warning,
    signal: new AbortController().signal, correlationId: crypto.randomUUID() });
const settle = async () => { for (let index = 0; index < 8; index++) await new Promise<void>(resolve => setImmediate(resolve)); };

describe('when observing SQL changes in process', () => {
    let fixture: a_sqlite_database;
    beforeEach(async () => { fixture = new a_sqlite_database(); await fixture.establish(); });
    afterEach(() => fixture.close());

    it('should prime a snapshot and adopt a change between prime and subscription', async () => {
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.SQLite, database: fixture.database,
            readModels: [{ type: TaskRecord, table: fixture.table }], observation: DrizzleObservation.InProcess });
        const app = await builder.build();
        const scope = app.server.services.createScope(identity());
        try {
            const models = await scope.resolve(drizzleReadModel(TaskRecord));
            const handle = await scope.resolve(drizzleDatabase());
            const observed = models.observe();
            (await observed.current()).value.should.have.lengthOf(2);
            fixture.native.run("insert into tasks values ('21112233-4455-6677-8899-aabbccddeeff', 'new')");
            handle.notifyChanged(TaskRecord);
            const emissions: TaskRecord[][] = [];
            const subscription = observed.subscribe(value => emissions.push(value));
            await settle();
            emissions.map(rows => rows.length).should.deep.equal([2, 3]);
            subscription.unsubscribe();
        } finally { await scope.dispose(); await app.dispose(); }
    });

    it('should scope announcements to the canonical tenant and registered table object', async () => {
        const bus = new DrizzleChangeNotifications(new Map([[TaskRecord, fixture.table]]), true);
        const handle = new DrizzleHandle(fixture.database, bus, 'default');
        const other = sqliteTable('tasks', { id: text('id').primaryKey() });
        (() => handle.notifyChanged(other)).should.throw('Unknown Drizzle read-model table: tasks');
        let hits = 0;
        const release = bus.listen('default', fixture.table, () => { hits++; });
        handle.notifyChanged(TaskRecord);
        hits.should.equal(1);
        bus.notify('other', [fixture.table]);
        hits.should.equal(1);
        release();
        bus.listenerCount('default').should.equal(0);
    });

    it('should buffer nested changes, publish on failure, and isolate independent commands', async () => {
        const bus = new DrizzleChangeNotifications(new Map([[TaskRecord, fixture.table]]), true);
        let hits = 0;
        const release = bus.listen('default', fixture.table, () => { hits++; });
        await bus.run('default', async () => {
            bus.notify('default', [TaskRecord]);
            await bus.run('default', async () => { bus.notify('default', [fixture.table]); });
            hits.should.equal(0);
        });
        hits.should.equal(1);
        try { await bus.run('default', async () => { bus.notify('default', [TaskRecord]); throw Error('failed'); }); }
        catch { /* A failed command can leave a nontransactional write behind. */ }
        hits.should.equal(2);
        let unblock!: () => void;
        const blocked = new Promise<void>(resolve => { unblock = resolve; });
        const first = bus.run('default', async () => { bus.notify('default', [TaskRecord]); await blocked; });
        await bus.run('default', async () => { bus.notify('default', [TaskRecord]); });
        hits.should.equal(3);
        unblock();
        await first;
        hits.should.equal(4);
        release();
    });

    it('should not deliver another tenant notification to a mixed-case tenant', async () => {
        const other = new a_sqlite_database();
        await other.establish();
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.SQLite,
            databaseFactory: tenant => tenant === 'default' ? fixture.database : other.database,
            readModels: [{ type: TaskRecord, table: fixture.table }], observation: DrizzleObservation.InProcess });
        const app = await builder.build();
        const scope = app.server.services.createScope(identity());
        const otherScope = app.server.services.createScope(identity('OTHER'));
        try {
            const models = await scope.resolve(drizzleReadModel(TaskRecord));
            const emissions: number[] = [];
            const subscription = models.observe().subscribe(rows => emissions.push(rows.length));
            await settle();
            other.native.run("insert into tasks values ('31112233-4455-6677-8899-aabbccddeeff', 'other')");
            (await otherScope.resolve(drizzleDatabase())).notifyChanged(TaskRecord);
            await settle();
            emissions.should.deep.equal([2]);
            fixture.native.run("insert into tasks values ('31112233-4455-6677-8899-aabbccddeeff', 'ours')");
            (await scope.resolve(drizzleDatabase())).notifyChanged(TaskRecord);
            await settle();
            emissions.should.deep.equal([2, 3]);
            subscription.unsubscribe();
        } finally { await scope.dispose(); await otherScope.dispose(); await app.dispose(); other.close(); }
    });

    it('should fail unpaged observation on overflow without emitting a truncated list', async () => {
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.SQLite, database: fixture.database,
            readModels: [{ type: TaskRecord, table: fixture.table }], maxPageSize: 2,
            observation: DrizzleObservation.InProcess });
        const app = await builder.build();
        const scope = app.server.services.createScope(identity());
        try {
            const models = await scope.resolve(drizzleReadModel(TaskRecord));
            const observed = models.observe();
            (await observed.current()).value.should.have.lengthOf(2);
            const errors: string[] = [];
            const subscription = observed.subscribe({ error: error => errors.push((error as Error).message) });
            fixture.native.run("insert into tasks values ('31112233-4455-6677-8899-aabbccddeeff', 'new')");
            (await scope.resolve(drizzleDatabase())).notifyChanged(fixture.table);
            await settle();
            errors.should.deep.equal(['The result exceeds the maximum of 2 items; use observePage for paged results']);
            subscription.unsubscribe();
            const later = models.observe();
            (await later.current().then(() => false, () => true)).should.equal(true);
        } finally { await scope.dispose(); await app.dispose(); }
    });

    it('should sort and page each announced change in SQL', async () => {
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.SQLite, database: fixture.database,
            readModels: [{ type: TaskRecord, table: fixture.table }], observation: DrizzleObservation.InProcess });
        const app = await builder.build();
        const scope = app.server.services.createScope(identity());
        try {
            const models = await scope.resolve(drizzleReadModel(TaskRecord));
            const pages: { title: string; total: number }[] = [];
            const observed = models.observePage(undefined, { paging: { page: 0, pageSize: 1 },
                sorting: { field: 'title', direction: SortDirection.Ascending } });
            const subscription = observed.subscribe(value => pages.push({ title: value.items[0]!.title,
                total: value.totalItems }));
            await settle();
            fixture.native.run("insert into tasks values ('41112233-4455-6677-8899-aabbccddeeff', '0')");
            (await scope.resolve(drizzleDatabase())).notifyChanged(TaskRecord);
            await settle();
            pages.should.deep.equal([{ title: 'a', total: 2 }, { title: '0', total: 3 }]);
            subscription.unsubscribe();
        } finally { await scope.dispose(); await app.dispose(); }
    });

    it('should update sorted pages and emit null for a deleted row before recreation', async () => {
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.SQLite, database: fixture.database,
            readModels: [{ type: TaskRecord, table: fixture.table }], observation: DrizzleObservation.InProcess });
        const app = await builder.build();
        const scope = app.server.services.createScope(identity());
        try {
            const models = await scope.resolve(drizzleReadModel(TaskRecord));
            const handle = await scope.resolve(drizzleDatabase());
            const pageTotals: number[] = [];
            const page = models.observePage(undefined, { paging: { page: 0, pageSize: 1 } });
            const pageSubscription = page.subscribe(value => pageTotals.push(value.totalItems));
            const id = '00112233-4455-6677-8899-aabbccddeeff';
            const seen: (string | null)[] = [];
            const byId = models.observeById(id);
            const idSubscription = byId.subscribe(value => seen.push(value?.title ?? null));
            await settle();
            fixture.database.delete(fixture.table).where(eq(fixture.table.title, 'z')).run();
            handle.notifyChanged(TaskRecord);
            await settle();
            fixture.native.run(`insert into tasks values ('${id}', 'again')`);
            handle.notifyChanged(TaskRecord);
            await settle();
            pageTotals.should.deep.equal([2, 1, 2]);
            seen.should.deep.equal(['z', null, 'again']);
            pageSubscription.unsubscribe();
            idSubscription.unsubscribe();
        } finally { await scope.dispose(); await app.dispose(); }
    });

    it('should retry a mismatched page three times and fail explicitly', async () => {
        let counts = 0;
        const fake = { select: fixture.database.select.bind(fixture.database), $count: () => { counts++; return 3; } };
        const bus = new DrizzleChangeNotifications(new Map([[TaskRecord, fixture.table]]), true);
        const models = new DrizzleReadModels(fake as unknown as DrizzleDatabase, fixture.table, TaskRecord, 100,
            undefined, bus, 'default');
        const observed = models.observePage(undefined, { paging: { page: 0, pageSize: 10 } });
        const error = await observed.current().then(() => '', failure => (failure as Error).message);
        error.should.equal('Drizzle observation could not read a consistent page');
        counts.should.equal(3);
        await models[Symbol.asyncDispose]();
        bus.listenerCount('default').should.equal(0);
    });

    it('should reject observation starts without the opt-in', async () => {
        const models = new DrizzleReadModels(fixture.database, fixture.table, TaskRecord);
        const error = await models.observe().current().then(() => '', failure => (failure as Error).message);
        error.should.equal('Drizzle observation is not enabled; set observation: DrizzleObservation.InProcess in withDrizzle');
        await models[Symbol.asyncDispose]();
    });

    it('should release a primed listener when the scope closes and reject future starts', async () => {
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.SQLite, database: fixture.database,
            readModels: [{ type: TaskRecord, table: fixture.table }], observation: DrizzleObservation.InProcess });
        const app = await builder.build();
        const scope = app.server.services.createScope(identity());
        const models = await scope.resolve(drizzleReadModel(TaskRecord));
        const observed = models.observe();
        await observed.current();
        await scope.dispose();
        (await observed.current().then(() => false, () => true)).should.equal(true);
        (await models.observe().current().then(() => false, () => true)).should.equal(true);
        await app.dispose();
    });
});
