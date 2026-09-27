// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Table } from 'drizzle-orm';
import type { DrizzleDatabase } from './DrizzleDatabase.js';
import type { DrizzleObservationLease } from './DrizzleObservationLease.js';
import type { PostgreSQLListenerConnection } from './PostgreSQLListenerConnection.js';
import type { PostgreSQLObservationOptions } from './PostgreSQLObservationOptions.js';
import { resolvePostgreSQLTable, type PostgreSQLTableIdentity } from './PostgreSQLTableIdentity.js';

type Lease = { table: Table; changed: () => void; fail: (error: Error) => void; key?: string; released: boolean };
type Entry = { tenant: string; controller: AbortController; leases: Set<Lease>; identities: Map<Table, PostgreSQLTableIdentity>;
    routing: Map<string, Set<Lease>>; connection?: PostgreSQLListenerConnection; startup: Promise<void>; timer?: ReturnType<typeof setTimeout>;
    dead: boolean; generation: number };

/** Internal, DI-owned, reference-counted PostgreSQL LISTEN sessions. No transparent reconnect. */
export class PostgreSQLObservationManager {
    readonly #entries = new Map<string, Entry>();
    readonly #closing = new Set<Promise<void>>();
    readonly #tenantCloses = new Map<string, Promise<void>>();
    readonly #closeFailures: unknown[] = [];
    #disposed = false;
    constructor(private readonly options: PostgreSQLObservationOptions,
        private readonly heartbeatIntervalMs = 30_000, private readonly operationTimeoutMs = 5_000) {}

    /** Acquire without blocking scope resolution; only ready leases may read model rows. */
    acquire(tenant: string, database: DrizzleDatabase, table: Table, changed: () => void, fail: (error: Error) => void): DrizzleObservationLease {
        if (this.#disposed) throw new Error('PostgreSQL change listener has been disposed');
        let entry = this.#entries.get(tenant);
        if (!entry) {
            entry = { tenant, controller: new AbortController(), leases: new Set(), identities: new Map(),
                routing: new Map(), startup: Promise.resolve(), dead: false, generation: 0 };
            this.#entries.set(tenant, entry);
            entry.startup = this.start(entry).catch(error => {
                const failure = new Error(`PostgreSQL change listener could not start for tenant '${tenant}': acquisition`, { cause: error });
                this.terminate(entry!, failure);
                throw failure;
            });
            void entry.startup.catch(() => {});
        }
        const owner = entry;
        const lease: Lease = { table, changed, fail, released: false };
        owner.leases.add(lease);
        const release = (): void => {
            if (lease.released) return;
            lease.released = true;
            owner.leases.delete(lease);
            if (lease.key) {
                const routed = owner.routing.get(lease.key);
                routed?.delete(lease);
                if (!routed?.size) owner.routing.delete(lease.key);
            }
            if (![...owner.leases].some(other => other.table === table)) owner.identities.delete(table);
            if (!owner.leases.size) this.shutdown(owner);
        };
        const ready = (async () => {
            try {
                await owner.startup;
                if (lease.released || owner.dead) throw new Error('Drizzle observation was closed');
                const identity = await this.bounded(owner, () => resolvePostgreSQLTable(database, table, tenant), undefined, false);
                if (lease.released || owner.dead) throw new Error('Drizzle observation was closed');
                const listenerDatabase = await this.bounded(owner, () => owner.connection!.query('SELECT current_database() AS database'));
                if (listenerDatabase.rows[0]?.database !== identity.database)
                    throw new Error(`PostgreSQL observation database/table mapping differs between reader and listener for tenant '${tenant}'`);
                await this.validate(owner, identity);
                if (lease.released || owner.dead) throw new Error('Drizzle observation was closed');
                const existing = owner.identities.get(table);
                if (existing && (existing.key !== identity.key || existing.database !== identity.database || existing.oid !== identity.oid))
                    throw new Error(`PostgreSQL observation database/table mapping differs between reader and listener for tenant '${tenant}'`);
                owner.identities.set(table, identity);
                lease.key = identity.key;
                let routed = owner.routing.get(identity.key);
                if (!routed) { routed = new Set(); owner.routing.set(identity.key, routed); }
                routed.add(lease);
            } catch (error) { release(); throw error; }
        })();
        void ready.catch(() => {});
        return { ready, release };
    }

    private async start(entry: Entry): Promise<void> {
        const previousClose = this.#tenantCloses.get(entry.tenant);
        // A failed close is reported on disposal, not inherited by the next lease. The socket-close barrier stays
        // in place, but waiting for it is bounded and abortable so a close that never settles cannot hang acquisitions.
        if (previousClose) await this.bounded(entry, () => previousClose.catch(() => {}));
        if (entry.dead) throw new Error('Drizzle observation was closed');
        const generation = ++entry.generation;
        const connection = await this.bounded(entry, () => Promise.resolve(this.options.listener(entry.tenant, { signal: entry.controller.signal })),
            late => { void this.scheduleClose(entry, late, false).catch(() => {}); });
        if (entry.dead) { await this.scheduleClose(entry, connection, false); throw new Error('Drizzle observation was closed'); }
        if (!connection || typeof connection.connect !== 'function' || typeof connection.query !== 'function' ||
            typeof connection.close !== 'function' || typeof connection.onNotification !== 'function' ||
            typeof connection.onDisconnect !== 'function' || 'release' in connection) {
            // The factory has transferred ownership even if the adapter shape is invalid.
            if (connection && typeof connection.close === 'function')
                void this.scheduleClose(entry, connection, false).catch(() => {});
            throw new Error('PostgreSQL listener requires a dedicated connection');
        }
        entry.connection = connection;
        connection.onDisconnect(error => {
            if (!entry.dead && generation === entry.generation)
                this.terminate(entry, new Error(`PostgreSQL change listener lost: ${error?.name === 'Error' ? 'connection failure' : 'connection closed'}`));
        });
        connection.onNotification((channel, payload) => {
            if (entry.dead || channel !== 'arc_changes' || !payload) return;
            // The first read starts after routing; earlier commits are already visible to it.
            for (const lease of [...entry.routing.get(payload) ?? []]) if (!lease.released) lease.changed();
        });
        await this.bounded(entry, () => connection.connect());
        await this.bounded(entry, () => connection.query('LISTEN "arc_changes"'));
        if (!entry.dead) this.heartbeat(entry);
    }

    private async validate(entry: Entry, identity: PostgreSQLTableIdentity): Promise<void> {
        let result: { rows: Record<string, unknown>[] };
        try { result = await this.bounded(entry, () => entry.connection!.query(`SELECT t.tgtype, t.tgenabled, t.tgqual IS NULL AS no_predicate,
            t.tgattr::text AS attributes, t.tgisinternal, t.tgconstraint::text AS constraint_oid, t.tgnargs,
            encode(t.tgargs, 'hex') AS arguments, p.proname, p.pronargs, p.prorettype = 'pg_catalog.trigger'::regtype AS returns_trigger,
            l.lanname, n.nspname AS function_schema
            FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            JOIN pg_catalog.pg_language l ON l.oid = p.prolang
            WHERE t.tgrelid = $1::oid AND t.tgname = 'arc_changes_v1'`, [identity.oid])); }
        catch (error) { throw new Error(`PostgreSQL observation cannot inspect triggers for '${identity.key}'; check catalog permissions`, { cause: error }); }
        const row = result.rows[0];
        let reason = 'missing';
        if (row) {
            if (row.tgenabled !== 'O' && row.tgenabled !== 'A') reason = 'disabled';
            else if (Number(row.tgtype) !== 60 || row.no_predicate !== true || String(row.attributes).trim() !== '' ||
                row.tgisinternal !== false || String(row.constraint_oid) !== '0') reason = 'events';
            else if (row.proname !== 'arc_notify_changes_v1' || row.function_schema !== identity.schema ||
                Number(row.pronargs) !== 0 || row.returns_trigger !== true || row.lanname !== 'plpgsql') reason = 'function version';
            else if (Number(row.tgnargs) !== 1 || row.arguments !== `${Buffer.from('arc_changes').toString('hex')}00`) reason = 'channel';
            else return;
        }
        throw new Error(`PostgreSQL observation trigger invalid for '${identity.key}': ${reason}; apply postgresqlChangeTrigger(...) through an application migration`);
    }

    private heartbeat(entry: Entry): void {
        entry.timer = setTimeout(() => {
            if (entry.dead) return;
            void this.bounded(entry, () => entry.connection!.query('SELECT 1')).then(() => {
                if (!entry.dead) this.heartbeat(entry);
            }, () => this.terminate(entry, new Error('PostgreSQL change listener lost: heartbeat failure')));
        }, this.heartbeatIntervalMs);
        entry.timer.unref?.();
    }

    private bounded<T>(entry: Entry, operation: () => Promise<T>, late?: (value: T) => void, listenerOperation = true): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                entry.controller.signal.removeEventListener('abort', abort);
                if (listenerOperation) this.terminate(entry, new Error('PostgreSQL change listener lost: operation timed out'));
                reject(new Error(listenerOperation ? 'PostgreSQL listener operation timed out' : 'PostgreSQL reader catalog lookup timed out'));
            }, this.operationTimeoutMs);
            const abort = (): void => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error('Drizzle observation was closed')); } };
            entry.controller.signal.addEventListener('abort', abort, { once: true });
            void Promise.resolve().then(operation).then(value => {
                clearTimeout(timer); entry.controller.signal.removeEventListener('abort', abort);
                if (settled) { late?.(value); return; }
                settled = true; resolve(value);
            }, error => {
                clearTimeout(timer); entry.controller.signal.removeEventListener('abort', abort);
                if (!settled) { settled = true; reject(error); }
            });
        });
    }

    private terminate(entry: Entry, error: Error): void {
        if (entry.dead) return;
        const leases = [...entry.leases];
        // Retire the entry before callbacks can synchronously resubscribe.
        this.shutdown(entry);
        for (const lease of leases) if (!lease.released) lease.fail(error);
    }

    private shutdown(entry: Entry): void {
        if (entry.dead) return;
        entry.dead = true;
        entry.generation++;
        entry.controller.abort();
        if (entry.timer) clearTimeout(entry.timer);
        entry.routing.clear(); entry.identities.clear();
        if (this.#entries.get(entry.tenant) === entry) this.#entries.delete(entry.tenant);
        if (entry.connection) this.scheduleClose(entry, entry.connection);
    }

    private scheduleClose(entry: Entry, connection: PostgreSQLListenerConnection, serialize = true): Promise<void> {
        const ending = Promise.resolve().then(() => connection.close());
        if (serialize) {
            // Keep the real socket-close barrier after its reporting deadline expires.
            this.#tenantCloses.set(entry.tenant, ending);
            void ending.then(() => {
                if (this.#tenantCloses.get(entry.tenant) === ending) this.#tenantCloses.delete(entry.tenant);
            }, () => {
                if (this.#tenantCloses.get(entry.tenant) === ending) this.#tenantCloses.delete(entry.tenant);
            });
        }
        let timer: ReturnType<typeof setTimeout>;
        const deadline = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('PostgreSQL listener close timed out')), this.operationTimeoutMs);
        });
        const closing = Promise.race([ending, deadline]).finally(() => clearTimeout(timer));
        this.#closing.add(closing);
        void closing.then(() => { this.#closing.delete(closing); },
            error => { this.#closing.delete(closing); this.#closeFailures.push(error); });
        return closing;
    }

    /** Dispose all Arc-owned sockets, including shutdowns already scheduled by RxJS teardown. */
    async [Symbol.asyncDispose](): Promise<void> {
        if (!this.#disposed) {
            this.#disposed = true;
            for (const entry of [...this.#entries.values()]) this.shutdown(entry);
        }
        const results = await Promise.allSettled([...this.#closing]);
        const failures = [...this.#closeFailures, ...results.filter(result => result.status === 'rejected').map(result => result.reason)];
        if (failures.length) throw new AggregateError(failures, 'PostgreSQL listener shutdown failed');
    }
}
