// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterAll, beforeAll, describe, it, should } from 'vitest';
import { Client, Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { drizzle as postgresDrizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { alias, pgTable, text } from 'drizzle-orm/pg-core';
import type { Table } from 'drizzle-orm';
import { ArcApplication, Severity } from '@cratis/arc.core';
import { drizzleReadModel } from '../../drizzleToken.js';
import '../../index.js';
import { Task } from './given/Task.js';
import { OtherTask } from './given/OtherTask.js';
import { DrizzleChangeNotifications } from '../../DrizzleChangeNotifications.js';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';
import { postgresqlChangeTrigger } from '../../postgresqlChangeTrigger.js';
import { nodePostgresListener } from '../../nodePostgresListener.js';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { DrizzleDialect } from '../../DrizzleDialect.js';

should();
const table = pgTable('tasks', { id: text('id').primaryKey(), title: text('title').notNull() });
const otherTable = pgTable('other_tasks', { id: text('id').primaryKey(), title: text('title').notNull() });
const uri = process.env.ARC_POSTGRES_TEST_URI;
if (!uri) throw new Error('ARC_POSTGRES_TEST_URI is required');
const schemaA = `arc_notify_a_${process.pid}`;
const schemaB = `arc_notify_b_${process.pid}`;
const applicationName = `arc_notify_${process.pid}`;
const waitFor = async (predicate: () => boolean, timeout = 4000): Promise<void> => {
    const deadline = Date.now() + timeout;
    while (!predicate() && Date.now() < deadline) await new Promise<void>(resolve => setTimeout(resolve, 15));
    predicate().should.equal(true);
};
const listener = () => nodePostgresListener(new Client({ connectionString: uri, application_name: applicationName }));

// SQL and schema identifiers in this suite come only from process-owned fixed-prefix schema names.
describe('when observing PostgreSQL changes across processes', () => {
    let admin: Pool;
    let first: Pool;
    let second: Pool;
    let manager: PostgreSQLObservationManager;
    let notifications: DrizzleChangeNotifications;
    const reader = (pool: Pool, tenant: string) => new DrizzleReadModels(drizzle(pool), table, Task, 100, undefined,
        { tenant, notifications, postgresql: manager });
    const write = (sql: string) => admin.query(sql);
    const collect = (models: DrizzleReadModels<Task>) => {
        const values: Task[][] = [];
        const errors: Error[] = [];
        const subscription = models.observe().subscribe({ next: value => values.push(value), error: error => errors.push(error) });
        return { values, errors, subscription };
    };
    beforeAll(async () => {
        admin = new Pool({ connectionString: uri });
        await admin.query(`CREATE SCHEMA "${schemaA}"`);
        await admin.query(`CREATE SCHEMA "${schemaB}"`);
        first = new Pool({ connectionString: uri, options: `-c search_path=${schemaA}` });
        second = new Pool({ connectionString: uri, options: `-c search_path=${schemaB}` });
        for (const schema of [schemaA, schemaB]) {
            await admin.query(`CREATE TABLE "${schema}".tasks (id text PRIMARY KEY, title text NOT NULL)`);
            await admin.query(postgresqlChangeTrigger(table, { schema }));
        }
        await admin.query(`CREATE TABLE "${schemaA}".other_tasks (id text PRIMARY KEY, title text NOT NULL)`);
        await admin.query(postgresqlChangeTrigger(otherTable, { schema: schemaA }));
        notifications = new DrizzleChangeNotifications(new Map<new () => object, Table>([[Task, table], [OtherTask, otherTable]]), false);
        manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify, listener });
    });
    afterAll(async () => {
        await manager?.[Symbol.asyncDispose]();
        await first?.end(); await second?.end();
        if (admin) {
            const result = await admin.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = $1', [applicationName]);
            result.rows[0].count.should.equal(0);
            await admin.query(`DROP SCHEMA IF EXISTS "${schemaA}" CASCADE`);
            await admin.query(`DROP SCHEMA IF EXISTS "${schemaB}" CASCADE`);
            await admin.end();
        }
    });
    it('should stream raw insert update delete and truncate after commit, without local notification', async () => {
        const model = reader(first, 'tenant-a');
        const stream = collect(model);
        try {
            await waitFor(() => stream.values.length === 1);
            await write(`INSERT INTO "${schemaA}".tasks VALUES ('1', 'first')`);
            await waitFor(() => stream.values.at(-1)?.[0]?.title === 'first');
            await write(`UPDATE "${schemaA}".tasks SET title = 'updated' WHERE id = '1'`);
            await waitFor(() => stream.values.at(-1)?.[0]?.title === 'updated');
            await write(`DELETE FROM "${schemaA}".tasks WHERE id = '1'`);
            await waitFor(() => stream.values.length > 1 && stream.values.at(-1)?.length === 0);
            await write(`INSERT INTO "${schemaA}".tasks VALUES ('2', 'second')`);
            await waitFor(() => stream.values.at(-1)?.[0]?.title === 'second');
            await write(`TRUNCATE "${schemaA}".tasks`);
            await waitFor(() => stream.values.at(-1)?.length === 0);
            stream.errors.should.have.lengthOf(0);
        } finally { stream.subscription.unsubscribe(); await model[Symbol.asyncDispose](); }
    });
    it('should withhold transaction changes until commit and ignore a rollback', async () => {
        const model = reader(first, 'transaction');
        const stream = collect(model);
        const writer = new Client({ connectionString: uri });
        try {
            await waitFor(() => stream.values.length === 1);
            await writer.connect();
            await writer.query('BEGIN');
            await writer.query(`INSERT INTO "${schemaA}".tasks VALUES ('pending', 'before commit')`);
            // The SELECT is an explicit barrier while the writing transaction remains open.
            await admin.query('SELECT pg_sleep(0.1)');
            stream.values.should.have.lengthOf(1);
            await writer.query('ROLLBACK');
            await admin.query('SELECT pg_sleep(0.1)');
            stream.values.should.have.lengthOf(1);
            await writer.query('BEGIN');
            await writer.query(`INSERT INTO "${schemaA}".tasks VALUES ('committed', 'after commit')`);
            await writer.query('COMMIT');
            await waitFor(() => stream.values.at(-1)?.some(task => task.id === 'committed') === true);
            stream.values.at(-1)!.some(task => task.id === 'pending').should.equal(false);
        } finally {
            stream.subscription.unsubscribe(); await model[Symbol.asyncDispose](); await writer.end();
            await write(`TRUNCATE "${schemaA}".tasks`);
        }
    });
    it('should isolate identical table names in two schemas on one database', async () => {
        const a = reader(first, 'a'); const b = reader(second, 'b');
        const left = collect(a); const right = collect(b);
        try {
            await waitFor(() => left.values.length === 1 && right.values.length === 1);
            await write(`INSERT INTO "${schemaB}".tasks VALUES ('b', 'only b')`);
            await waitFor(() => right.values.at(-1)?.[0]?.title === 'only b');
            left.values.at(-1)!.should.have.lengthOf(0);
            left.values.should.have.lengthOf(1);
        } finally {
            left.subscription.unsubscribe(); right.subscription.unsubscribe();
            await a[Symbol.asyncDispose](); await b[Symbol.asyncDispose]();
        }
    });
    it('should isolate identical table names in two databases', async () => {
        const name = `arc_notify_db_${process.pid}`;
        const otherUri = new URL(uri!);
        otherUri.pathname = `/${name}`;
        await admin.query(`CREATE DATABASE "${name}"`);
        const other = new Pool({ connectionString: otherUri.toString() });
        const isolated = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: tenant => nodePostgresListener(new Client({ connectionString: tenant === 'second' ? otherUri.toString() : uri,
                application_name: applicationName })) });
        try {
            await other.query('CREATE TABLE public.tasks (id text PRIMARY KEY, title text NOT NULL)');
            await other.query(postgresqlChangeTrigger(table, { schema: 'public' }));
            const left = new DrizzleReadModels(drizzle(first), table, Task, 100, undefined,
                { tenant: 'first', notifications, postgresql: isolated });
            const right = new DrizzleReadModels(drizzle(other), table, Task, 100, undefined,
                { tenant: 'second', notifications, postgresql: isolated });
            const one = collect(left); const two = collect(right);
            try {
                await waitFor(() => one.values.length === 1 && two.values.length === 1);
                await other.query("INSERT INTO public.tasks VALUES ('other', 'different database')");
                await waitFor(() => two.values.at(-1)?.some(task => task.title === 'different database') === true);
                one.values.at(-1)!.some(task => task.title === 'different database').should.equal(false);
                one.values.should.have.lengthOf(1);
            } finally {
                one.subscription.unsubscribe(); two.subscription.unsubscribe();
                await left[Symbol.asyncDispose](); await right[Symbol.asyncDispose]();
            }
        } finally {
            await isolated[Symbol.asyncDispose](); await other.end();
            await admin.query(`DROP DATABASE "${name}"`);
        }
    });
    it('should reject an alias even when its name belongs to another existing triggered table', async () => {
        const aliased = alias(table, 'other_tasks');
        const model = new DrizzleReadModels(drizzle(first), aliased, Task, 100, undefined,
            { tenant: 'alias', notifications, postgresql: manager });
        const stream = collect(model);
        try {
            await waitFor(() => stream.errors.length === 1);
            stream.errors[0]!.message.should.include('aliased');
            stream.values.should.have.lengthOf(0);
        } finally { stream.subscription.unsubscribe(); await model[Symbol.asyncDispose](); }
    });
    it('should reject a partition whose writes go through its parent', async () => {
        const partition = pgTable('tasks_partition', { id: text('id').primaryKey(), title: text('title').notNull() });
        await admin.query(`CREATE TABLE "${schemaA}".partitioned_tasks (id text NOT NULL, title text NOT NULL) PARTITION BY LIST (id)`);
        await admin.query(`CREATE TABLE "${schemaA}".tasks_partition PARTITION OF "${schemaA}".partitioned_tasks DEFAULT`);
        await admin.query(postgresqlChangeTrigger(partition, { schema: schemaA }));
        const model = new DrizzleReadModels(drizzle(first), partition, Task, 100, undefined,
            { tenant: 'partition', notifications, postgresql: manager });
        const stream = collect(model);
        try {
            await waitFor(() => stream.errors.length === 1);
            stream.errors[0]!.message.should.include('partitions or inheritance');
            stream.values.should.have.lengthOf(0);
        } finally {
            stream.subscription.unsubscribe(); await model[Symbol.asyncDispose]();
            await admin.query(`DROP TABLE "${schemaA}".partitioned_tasks CASCADE`);
        }
    });
    it('should reject an inheritance parent whose reads include a child table', async () => {
        const parent = pgTable('parent_tasks', { id: text('id').primaryKey(), title: text('title').notNull() });
        await admin.query(`CREATE TABLE "${schemaA}".parent_tasks (id text PRIMARY KEY, title text NOT NULL)`);
        await admin.query(`CREATE TABLE "${schemaA}".child_tasks () INHERITS ("${schemaA}".parent_tasks)`);
        await admin.query(postgresqlChangeTrigger(parent, { schema: schemaA }));
        const model = new DrizzleReadModels(drizzle(first), parent, Task, 100, undefined,
            { tenant: 'inheritance', notifications, postgresql: manager });
        const stream = collect(model);
        try {
            await waitFor(() => stream.errors.length === 1);
            stream.errors[0]!.message.should.include('partitions or inheritance');
            stream.values.should.have.lengthOf(0);
        } finally {
            stream.subscription.unsubscribe(); await model[Symbol.asyncDispose]();
            await admin.query(`DROP TABLE "${schemaA}".parent_tasks CASCADE`);
        }
    });
    it('should route a dotted table identifier using PostgreSQL-quoted payloads', async () => {
        const dotted = pgTable('odd.tasks', { id: text('id').primaryKey(), title: text('title').notNull() });
        await admin.query(`CREATE TABLE "${schemaA}"."odd.tasks" (id text PRIMARY KEY, title text NOT NULL)`);
        await admin.query(postgresqlChangeTrigger(dotted, { schema: schemaA }));
        const model = new DrizzleReadModels(drizzle(first), dotted, Task, 100, undefined,
            { tenant: 'dotted', notifications, postgresql: manager });
        const stream = collect(model);
        try {
            await waitFor(() => stream.values.length === 1);
            await write(`INSERT INTO "${schemaA}"."odd.tasks" VALUES ('quoted', 'routed')`);
            await waitFor(() => stream.values.at(-1)?.[0]?.title === 'routed');
        } finally {
            stream.subscription.unsubscribe(); await model[Symbol.asyncDispose]();
            await admin.query(`DROP TABLE "${schemaA}"."odd.tasks"`);
        }
    });
    it('should canonicalize mixed-case tenants and share the DI-owned listener', async () => {
        const name = `arc_notify_case_${process.pid}`;
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.PostgreSQL, databaseFactory: () => drizzle(first),
            readModels: [{ type: Task, table }], observation: { mode: DrizzleObservation.PostgreSQLNotify,
                listener: () => nodePostgresListener(new Client({ connectionString: uri, application_name: name })) } });
        const app = await builder.build();
        const scopeFor = (tenantId: string) => app.server.services.createScope({ tenantId, principal: undefined,
            allowedSeverity: Severity.Warning, correlationId: crypto.randomUUID(), signal: new AbortController().signal });
        const firstScope = scopeFor('MiXeD'); const secondScope = scopeFor('mixed');
        try {
            const a = await firstScope.resolve(drizzleReadModel(Task));
            const b = await secondScope.resolve(drizzleReadModel(Task));
            const left = collect(a); const right = collect(b);
            try {
                await waitFor(() => left.values.length === 1 && right.values.length === 1);
                const count = await admin.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = $1', [name]);
                count.rows[0].count.should.equal(1);
            } finally { left.subscription.unsubscribe(); right.subscription.unsubscribe(); }
        } finally { await firstScope.dispose(); await secondScope.dispose(); await app.dispose(); }
    });
    it('should read through postgres.js while listening on a node-postgres client', async () => {
        const client = postgres(uri!, { connection: { search_path: schemaA }, max: 1 });
        const model = new DrizzleReadModels(postgresDrizzle(client), table, Task, 100, undefined,
            { tenant: 'postgres-js', notifications, postgresql: manager });
        const stream = collect(model);
        try {
            await waitFor(() => stream.values.length === 1);
            await write(`INSERT INTO "${schemaA}".tasks VALUES ('js', 'postgres js')`);
            await waitFor(() => stream.values.at(-1)?.some(task => task.title === 'postgres js') === true);
        } finally {
            stream.subscription.unsubscribe(); await model[Symbol.asyncDispose](); await client.end();
        }
    });
    it('should not read rows until LISTEN is acknowledged', async () => {
        let acknowledge!: () => void;
        let entered = false;
        const gate = new Promise<void>(resolve => { acknowledge = resolve; });
        let reads = 0;
        const native = drizzle(first);
        const tracked = new Proxy(native, { get(target, property) {
            const value: unknown = Reflect.get(target, property);
            if (property !== 'select') return value;
            return (...args: unknown[]) => { reads++; return (value as (...args: unknown[]) => unknown).apply(target, args); };
        } });
        const gated = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => {
                const connection = listener();
                return { ...connection, async query(statement: string, values?: readonly unknown[]) {
                    if (statement.startsWith('LISTEN')) { entered = true; await gate; }
                    return connection.query(statement, values);
                } };
            } });
        const model = new DrizzleReadModels(tracked, table, Task, 100, undefined,
            { tenant: 'gated', notifications, postgresql: gated });
        const stream = collect(model);
        try {
            await waitFor(() => entered);
            reads.should.equal(0);
            stream.values.should.have.lengthOf(0);
            await write(`INSERT INTO "${schemaA}".tasks VALUES ('gate', 'after ack')`);
            acknowledge();
            await waitFor(() => stream.values.at(-1)?.some(task => task.id === 'gate') === true);
        } finally {
            acknowledge(); stream.subscription.unsubscribe(); await model[Symbol.asyncDispose]();
            await gated[Symbol.asyncDispose](); await write(`DELETE FROM "${schemaA}".tasks WHERE id = 'gate'`);
        }
    });
    it('should cancel a pending LISTEN acquisition when the read-model scope closes', async () => {
        const name = `arc_notify_abort_${process.pid}`;
        let entered = false;
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const acquiring = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => {
                const connection = nodePostgresListener(new Client({ connectionString: uri, application_name: name }));
                return { ...connection, async query(statement: string, values?: readonly unknown[]) {
                    if (statement.startsWith('LISTEN')) { entered = true; await gate; }
                    return connection.query(statement, values);
                } };
            } });
        const model = new DrizzleReadModels(drizzle(first), table, Task, 100, undefined,
            { tenant: 'abort', notifications, postgresql: acquiring });
        try {
            const current = model.observe().current().then(() => false, () => true);
            await waitFor(() => entered);
            await model[Symbol.asyncDispose]();
            (await current).should.equal(true);
            release();
            await acquiring[Symbol.asyncDispose]();
            const deadline = Date.now() + 4000;
            let active = 1;
            while (active && Date.now() < deadline) {
                active = (await admin.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = $1', [name])).rows[0].count;
                if (active) await new Promise<void>(resolve => setTimeout(resolve, 15));
            }
            active.should.equal(0);
        } finally { release(); await model[Symbol.asyncDispose](); await acquiring[Symbol.asyncDispose](); }
    });
    it('should share a tenant listener and close its backend after the last unsubscribe', async () => {
        const name = `arc_notify_shared_${process.pid}`;
        const shared = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => nodePostgresListener(new Client({ connectionString: uri, application_name: name })) });
        const a = new DrizzleReadModels(drizzle(first), table, Task, 100, undefined,
            { tenant: 'shared', notifications, postgresql: shared });
        const b = new DrizzleReadModels(drizzle(first), otherTable, OtherTask, 100, undefined,
            { tenant: 'shared', notifications, postgresql: shared });
        const one = collect(a); const two = collect(b);
        const active = async () => (await admin.query('SELECT pid FROM pg_stat_activity WHERE application_name = $1', [name])).rows;
        try {
            await waitFor(() => one.values.length === 1 && two.values.length === 1);
            (await active()).should.have.lengthOf(1);
            await write(`INSERT INTO "${schemaA}".other_tasks VALUES ('one', 'other table')`);
            await waitFor(() => two.values.at(-1)?.[0]?.title === 'other table');
            one.values.at(-1)!.some(task => task.title === 'other table').should.equal(false);
            one.subscription.unsubscribe();
            (await active()).should.have.lengthOf(1);
            two.subscription.unsubscribe();
            const deadline = Date.now() + 4000;
            while ((await active()).length && Date.now() < deadline)
                await new Promise<void>(resolve => setTimeout(resolve, 15));
            (await active()).should.have.lengthOf(0);
        } finally {
            one.subscription.unsubscribe(); two.subscription.unsubscribe();
            await a[Symbol.asyncDispose](); await b[Symbol.asyncDispose](); await shared[Symbol.asyncDispose]();
        }
    });
    it('should catch up all live subscribers and an unused prime after terminating the listener backend', async () => {
        const name = `arc_notify_reconnect_${process.pid}`;
        let reconnect!: () => void;
        let reconnecting!: () => void;
        const entered = new Promise<void>(resolve => { reconnecting = resolve; });
        const gate = new Promise<void>(resolve => { reconnect = resolve; });
        let attempts = 0;
        const recovering = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: async () => {
                if (++attempts > 1) { reconnecting(); await gate; }
                return nodePostgresListener(new Client({ connectionString: uri, application_name: name }));
            } }, 30_000, 5000, [20, 40]);
        const model = new DrizzleReadModels(drizzle(first), table, Task, 100, undefined,
            { tenant: 'recovery', notifications, postgresql: recovering });
        const prime = model.observe();
        const one = collect(model); const two = collect(model);
        try {
            await waitFor(() => one.values.length === 1 && two.values.length === 1);
            (await prime.current()).value.should.be.an('array');
            const pids = await admin.query('SELECT pid FROM pg_stat_activity WHERE application_name = $1', [name]);
            const pid = pids.rows[0]?.pid;
            if (!pid) throw new Error('Listener PID missing');
            await admin.query('SELECT pg_terminate_backend($1)', [pid]);
            await entered;
            await write(`INSERT INTO "${schemaA}".tasks VALUES ('recovered', 'committed during gap')`);
            one.values.should.have.lengthOf(1);
            two.values.should.have.lengthOf(1);
            reconnect();
            await waitFor(() => one.values.at(-1)?.some(task => task.id === 'recovered') === true &&
                two.values.at(-1)?.some(task => task.id === 'recovered') === true);
            (await prime.current()).value.some(task => task.id === 'recovered').should.equal(true);
            one.errors.should.have.lengthOf(0); two.errors.should.have.lengthOf(0);
        } finally {
            reconnect(); one.subscription.unsubscribe(); two.subscription.unsubscribe(); prime.close();
            await model[Symbol.asyncDispose](); await recovering[Symbol.asyncDispose]();
            await write(`DELETE FROM "${schemaA}".tasks WHERE id = 'recovered'`);
        }
    });
    it('should observe under a role without DDL privileges and not install a missing trigger', async () => {
        const role = `arc_notify_role_${process.pid}`;
        const limitedUri = new URL(uri!); limitedUri.username = role; limitedUri.password = 'read_only_test';
        await admin.query(`CREATE ROLE "${role}" LOGIN PASSWORD 'read_only_test'`);
        const limited = new Pool({ connectionString: limitedUri.toString(), options: `-c search_path=${schemaA}` });
        const restricted = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => nodePostgresListener(new Client({ connectionString: limitedUri.toString() })) });
        try {
            await admin.query(`GRANT USAGE ON SCHEMA "${schemaA}" TO "${role}"`);
            await admin.query(`GRANT SELECT ON "${schemaA}".tasks TO "${role}"`);
            await admin.query(`CREATE TABLE "${schemaA}".unmigrated (id text PRIMARY KEY, title text NOT NULL)`);
            await admin.query(`GRANT SELECT ON "${schemaA}".unmigrated TO "${role}"`);
            const valid = new DrizzleReadModels(drizzle(limited), table, Task, 100, undefined,
                { tenant: 'limited', notifications, postgresql: restricted });
            const invalidTable = pgTable('unmigrated', { id: text('id').primaryKey(), title: text('title').notNull() });
            const invalid = new DrizzleReadModels(drizzle(limited), invalidTable, Task, 100, undefined,
                { tenant: 'limited', notifications, postgresql: restricted });
            try {
                (await valid.observe().current()).value.should.be.an('array');
                const reason = await invalid.observe().current().then(() => '', (error: Error) => error.message);
                reason.should.include('trigger invalid');
                const triggers = await admin.query(`SELECT count(*)::int AS count FROM pg_trigger WHERE tgrelid = '"${schemaA}".unmigrated'::regclass`);
                triggers.rows[0].count.should.equal(0);
            } finally { await valid[Symbol.asyncDispose](); await invalid[Symbol.asyncDispose](); }
        } finally {
            await restricted[Symbol.asyncDispose](); await limited.end();
            await admin.query(`DROP TABLE IF EXISTS "${schemaA}".unmigrated`);
            await admin.query(`DROP OWNED BY "${role}"`);
            await admin.query(`DROP ROLE "${role}"`);
        }
    });
    for (const fault of ['disabled', 'replica-only', 'wrong events', 'wrong channel', 'wrong function'] as const) {
        it(`should reject a ${fault} trigger before reading model rows`, async () => {
            const target = `"${schemaB}".tasks`;
            const functionName = `"${schemaB}"."arc_notify_changes_v1"`;
            await admin.query(`DROP TRIGGER "arc_changes_v1" ON ${target}`);
            const replacement = fault === 'wrong function' ? `"${schemaB}"."arc_notify_changes_v2"` : functionName;
            try {
                if (fault === 'wrong function') await admin.query(`CREATE FUNCTION ${replacement}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$`);
                await admin.query(`CREATE TRIGGER "arc_changes_v1" AFTER ${fault === 'wrong events' ? 'INSERT' :
                    'INSERT OR UPDATE OR DELETE OR TRUNCATE'} ON ${target} FOR EACH STATEMENT EXECUTE FUNCTION ${replacement}('${fault === 'wrong channel' ? 'wrong' : 'arc_changes'}')`);
                if (fault === 'disabled') await admin.query(`ALTER TABLE ${target} DISABLE TRIGGER "arc_changes_v1"`);
                if (fault === 'replica-only') await admin.query(`ALTER TABLE ${target} ENABLE REPLICA TRIGGER "arc_changes_v1"`);
                const model = reader(second, `invalid-${fault}`);
                try {
                    const stream = collect(model);
                    await waitFor(() => stream.errors.length === 1);
                    stream.values.should.have.lengthOf(0);
                    stream.errors[0]!.message.should.include('trigger invalid');
                } finally { await model[Symbol.asyncDispose](); }
            } finally {
                await admin.query(`DROP TRIGGER "arc_changes_v1" ON ${target}`);
                await admin.query(postgresqlChangeTrigger(table, { schema: schemaB }));
            }
        });
    }
    it('should reject an absent trigger before reading any model rows', async () => {
        await admin.query(`DROP TRIGGER "arc_changes_v1" ON "${schemaB}".tasks`);
        const model = reader(second, 'missing');
        try {
            const stream = collect(model);
            await waitFor(() => stream.errors.length === 1);
            stream.errors[0]!.message.should.include('trigger invalid');
            stream.values.should.have.lengthOf(0);
        } finally {
            await admin.query(postgresqlChangeTrigger(table, { schema: schemaB }));
            await model[Symbol.asyncDispose]();
        }
    });
});
