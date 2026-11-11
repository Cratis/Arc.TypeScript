// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Table } from 'drizzle-orm';
import type { DrizzleDatabase } from './DrizzleDatabase.js';
import type { DrizzleObservationLease } from './DrizzleObservationLease.js';
import type { PostgreSQLListenerConnection } from './PostgreSQLListenerConnection.js';
import type { PostgreSQLObservationOptions } from './PostgreSQLObservationOptions.js';
import { DefinitivePostgreSQLObservationError, resolvePostgreSQLTable, type PostgreSQLTableIdentity } from './PostgreSQLTableIdentity.js';

/** A transient reader-side failure during recovery; it spends a retry instead of failing the observation. */
class ReaderRevalidationError extends Error {}

type Lease = { table: Table; database: DrizzleDatabase; changed: (catchup?: boolean) => void; fail: (error: Error) => void; complete?: () => void; key?: string; released: boolean };
type Entry = { tenant: string; controller: AbortController; leases: Set<Lease>; identities: Map<Table, PostgreSQLTableIdentity>;
    routing: Map<string, Set<Lease>>; connection?: PostgreSQLListenerConnection; startup: Promise<void>; timer?: ReturnType<typeof setTimeout>;
    retryTimer?: ReturnType<typeof setTimeout>; retryWake?: () => void; dead: boolean; generation: number; available: boolean;
    readiness: Promise<number>; resolveReady: (generation: number) => void; rejectReady: (error: Error) => void;
    retries: number; wasReady: boolean; lossReason?: string; lossCause?: Error };

const reconnectDelaysMs = [500, 1000, 2000, 4000, 8000] as const;
const readiness = () => {
    let resolve!: (generation: number) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<number>((yes, no) => { resolve = yes; reject = no; });
    void promise.catch(() => {});
    return { promise, resolve, reject };
};

/** Internal, DI-owned, reference-counted PostgreSQL LISTEN sessions with bounded recovery. */
export class PostgreSQLObservationManager {
    readonly #entries = new Map<string, Entry>();
    readonly #closing = new Set<Promise<void>>();
    readonly #pendingFactories = new Set<Promise<void>>();
    readonly #tenantCloses = new Map<string, Promise<void>>();
    readonly #closeFailures: unknown[] = [];
    #discardedCloseFailures = 0;
    #disposal?: Promise<void>;
    #disposed = false;
    constructor(private readonly options: PostgreSQLObservationOptions,
        private readonly heartbeatIntervalMs = 30_000, private readonly operationTimeoutMs = 5_000,
        private readonly delays: readonly number[] = reconnectDelaysMs) {}

    /** Acquire without blocking scope resolution; only ready leases may read model rows. */
    acquire(tenant: string, database: DrizzleDatabase, table: Table, changed: (catchup?: boolean) => void, fail: (error: Error) => void,
        complete?: () => void): DrizzleObservationLease {
        if (this.#disposed) throw new Error('PostgreSQL change listener has been disposed');
        const owner = this.#entries.get(tenant) ?? this.createEntry(tenant);
        const lease: Lease = { table, database, changed, fail, complete, released: false };
        owner.leases.add(lease);
        const release = (): void => this.release(owner, lease);
        const ready = this.prepareLease(owner, lease);
        void ready.catch(() => {});
        return { ready, release, whenReady: () => owner.dead || lease.released ? Promise.reject(new Error('Drizzle observation was closed')) : owner.readiness,
            isCurrent: generation => !owner.dead && owner.available && owner.generation === generation };
    }

    private createEntry(tenant: string): Entry {
        const gate = readiness();
        const entry: Entry = { tenant, controller: new AbortController(), leases: new Set(), identities: new Map(),
            routing: new Map(), startup: Promise.resolve(), dead: false, generation: 0, available: false,
            readiness: gate.promise, resolveReady: gate.resolve, rejectReady: gate.reject, retries: 0, wasReady: false };
        this.#entries.set(tenant, entry);
        entry.startup = this.start(entry).catch(error => {
            const failure = new Error(`PostgreSQL change listener could not start for tenant '${tenant}': acquisition`, { cause: error });
            this.terminate(entry, failure);
            throw failure;
        });
        void entry.startup.catch(() => {});
        return entry;
    }

    private release(owner: Entry, lease: Lease): void {
        if (lease.released) return;
        lease.released = true;
        owner.leases.delete(lease);
        if (lease.key) {
            const routed = owner.routing.get(lease.key);
            routed?.delete(lease);
            if (!routed?.size) owner.routing.delete(lease.key);
        }
        if (![...owner.leases].some(other => other.table === lease.table)) owner.identities.delete(lease.table);
        if (!owner.leases.size) this.shutdown(owner);
    }

    private async prepareLease(owner: Entry, lease: Lease): Promise<void> {
        try {
            await owner.startup;
            while (true) {
                this.requireLiveLease(owner, lease);
                if (owner.wasReady && !owner.available) await owner.readiness;
                this.requireLiveLease(owner, lease);
                const generation = owner.generation;
                try {
                    if (await this.prepareLeaseAttempt(owner, lease, generation)) break;
                } catch (error) {
                    if (this.canRetryLease(owner, lease, generation)) continue;
                    throw error;
                }
            }
        } catch (error) { this.release(owner, lease); throw error; }
    }

    private async prepareLeaseAttempt(owner: Entry, lease: Lease, generation: number): Promise<boolean> {
        const identity = await this.bounded(owner, () => resolvePostgreSQLTable(lease.database, lease.table, owner.tenant), undefined, false);
        this.requireLiveLease(owner, lease);
        // A loss during a reader operation invalidates the listener used for the rest of validation.
        if (this.needsRevalidation(owner, generation)) return false;
        const listenerDatabase = await this.bounded(owner, () => owner.connection!.query('SELECT current_database() AS database')
            .catch(error => { throw new Error(`PostgreSQL observation could not verify the listener database for tenant '${owner.tenant}'`, { cause: error }); }));
        if (listenerDatabase.rows[0]?.database !== identity.database)
            throw new Error(this.mappingFailure(owner));
        await this.validate(owner, identity);
        this.requireLiveLease(owner, lease);
        if (this.needsRevalidation(owner, generation)) return false;
        this.routeLease(owner, lease, identity);
        return true;
    }

    private canRetryLease(owner: Entry, lease: Lease, generation: number): boolean {
        return !lease.released && !owner.dead && this.needsRevalidation(owner, generation);
    }

    private mappingFailure(entry: Entry): string {
        return `PostgreSQL observation database/table mapping differs between reader and listener for tenant '${entry.tenant}'`;
    }

    private requireLiveLease(owner: Entry, lease: Lease): void {
        if (lease.released || owner.dead) throw new Error('Drizzle observation was closed');
    }

    private needsRevalidation(owner: Entry, generation: number): boolean {
        return owner.wasReady && (generation !== owner.generation || !owner.available);
    }

    private routeLease(owner: Entry, lease: Lease, identity: PostgreSQLTableIdentity): void {
        const existing = owner.identities.get(lease.table);
        if (existing && this.mappingDiffers(existing, identity))
            throw new Error(this.mappingFailure(owner));
        owner.identities.set(lease.table, identity);
        lease.key = identity.key;
        let routed = owner.routing.get(identity.key);
        if (!routed) { routed = new Set(); owner.routing.set(identity.key, routed); }
        routed.add(lease);
        if (!owner.wasReady) {
            owner.available = true;
            owner.wasReady = true;
            owner.resolveReady(owner.generation);
            this.heartbeat(owner);
        }
    }

    private mappingDiffers(first: Pick<PostgreSQLTableIdentity, 'key' | 'database'>, second: { key: string; database: string | undefined }): boolean {
        return first.key !== second.key || first.database !== second.database;
    }

    private isLiveGeneration(entry: Entry, generation: number): boolean {
        return !entry.dead && generation === entry.generation;
    }

    private async start(entry: Entry): Promise<void> {
        const previousClose = this.#tenantCloses.get(entry.tenant);
        // A failed close is reported on disposal, not inherited by the next lease. The socket-close barrier stays
        // in place, but waiting for it is bounded and abortable so a close that never settles cannot hang acquisitions.
        if (previousClose) await this.bounded(entry, () => previousClose.catch(() => {}));
        if (entry.dead) throw new Error('Drizzle observation was closed');
        const generation = ++entry.generation;
        const connection = await this.bounded(entry, () => Promise.resolve(this.options.listener(entry.tenant, { signal: entry.controller.signal })),
            late => { void this.scheduleClose(entry, late, false).catch(() => {}); }, true, true);
        if (entry.dead) { await this.scheduleClose(entry, connection, false); throw new Error('Drizzle observation was closed'); }
        this.requireDedicatedConnection(entry, connection);
        entry.connection = connection;
        connection.onDisconnect(error => {
            if (this.isLiveGeneration(entry, generation))
                this.lost(entry, new Error(`PostgreSQL change listener lost: ${error ? 'connection failure' : 'connection closed'}`));
        });
        connection.onNotification((channel, payload) => this.notify(entry, generation, channel, payload));
        await this.bounded(entry, () => connection.connect());
        await this.bounded(entry, () => connection.query('LISTEN "arc_changes"'));
        if (!this.isLiveGeneration(entry, generation)) throw new Error('Drizzle observation was closed');
    }

    private requireDedicatedConnection(entry: Entry, connection: PostgreSQLListenerConnection): void {
        if (!connection || typeof connection.connect !== 'function' || typeof connection.query !== 'function' ||
            typeof connection.close !== 'function' || typeof connection.onNotification !== 'function' ||
            typeof connection.onDisconnect !== 'function' || 'release' in connection) {
            // The factory has transferred ownership even if the adapter shape is invalid.
            if (connection && typeof connection.close === 'function')
                void this.scheduleClose(entry, connection, false).catch(() => {});
            throw new Error('PostgreSQL listener requires a dedicated connection');
        }
    }

    private notify(entry: Entry, generation: number, channel: string, payload?: string): void {
        if (!this.isLiveGeneration(entry, generation) || channel !== 'arc_changes' || !payload) return;
        // The first read starts after routing; earlier commits are already visible to it.
        for (const lease of [...entry.routing.get(payload) ?? []]) if (!lease.released) lease.changed();
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
        catch (error) {
            this.handleValidationFailure(entry, identity, error);
        }
        const reason = this.triggerFailure(result.rows[0], identity.schema);
        if (reason)
            throw new DefinitivePostgreSQLObservationError(`PostgreSQL observation trigger invalid for '${identity.key}': ${reason}; apply postgresqlChangeTrigger(...) through an application migration`);
    }

    private handleValidationFailure(entry: Entry, identity: PostgreSQLTableIdentity, error: unknown): never {
        const permissionDenied = (error as { code?: unknown })?.code === '42501';
        if (entry.wasReady && !entry.available && !permissionDenied)
            this.lost(entry, new Error('PostgreSQL change listener lost: validation failure'));
        const message = `PostgreSQL observation cannot inspect triggers for '${identity.key}'`;
        if (permissionDenied) throw new DefinitivePostgreSQLObservationError(`${message}; check catalog permissions`, { cause: error });
        throw new Error(message, { cause: error });
    }

    private triggerFailure(row: Record<string, unknown> | undefined, schema: string): string | undefined {
        if (!row) return 'missing';
        if (row.tgenabled !== 'O' && row.tgenabled !== 'A') return 'disabled';
        if (!this.hasExpectedEvents(row)) return 'events';
        if (!this.hasExpectedFunction(row, schema)) return 'function version';
        if (Number(row.tgnargs) !== 1 || row.arguments !== `${Buffer.from('arc_changes').toString('hex')}00`) return 'channel';
        return undefined;
    }

    private hasExpectedEvents(row: Record<string, unknown>): boolean {
        return Number(row.tgtype) === 60 && row.no_predicate === true && String(row.attributes).trim() === ''
            && row.tgisinternal === false && String(row.constraint_oid) === '0';
    }

    private hasExpectedFunction(row: Record<string, unknown>, schema: string): boolean {
        return row.proname === 'arc_notify_changes_v1' && row.function_schema === schema
            && Number(row.pronargs) === 0 && row.returns_trigger === true && row.lanname === 'plpgsql';
    }

    private heartbeat(entry: Entry): void {
        const generation = entry.generation;
        entry.timer = setTimeout(() => {
            if (entry.dead || generation !== entry.generation) return;
            void this.bounded(entry, () => entry.connection!.query('SELECT 1')).then(() => {
                if (!entry.dead && generation === entry.generation) {
                    entry.retries = 0;
                    this.heartbeat(entry);
                }
            }, () => { if (generation === entry.generation) this.lost(entry, new Error('PostgreSQL change listener lost: heartbeat failure')); });
        }, this.heartbeatIntervalMs);
        entry.timer.unref?.();
    }

    private bounded<T>(entry: Entry, operation: () => Promise<T>, late?: (value: T) => void,
        listenerOperation = true, trackFactory = false): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const signal = entry.controller.signal;
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                signal.removeEventListener('abort', abort);
                if (listenerOperation) this.lost(entry, new Error('PostgreSQL change listener lost: operation timed out'));
                reject(new Error(listenerOperation ? 'PostgreSQL listener operation timed out' : 'PostgreSQL reader catalog lookup timed out'));
            }, this.operationTimeoutMs);
            const abort = (): void => { if (!settled) { settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
                reject(new Error('Drizzle observation was closed')); } };
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted) { abort(); return; }
            const completion = Promise.resolve().then(operation).then(value => {
                clearTimeout(timer); signal.removeEventListener('abort', abort);
                if (settled) { late?.(value); return; }
                settled = true; resolve(value);
            }, error => {
                clearTimeout(timer); signal.removeEventListener('abort', abort);
                if (!settled) { settled = true; reject(error); }
            });
            if (trackFactory) {
                const pending = completion.then(() => {}, () => {});
                this.#pendingFactories.add(pending);
                void pending.then(() => this.#pendingFactories.delete(pending));
            }
        });
    }

    private lost(entry: Entry, error: Error): void {
        if (entry.dead || entry.controller.signal.aborted) return;
        if (!entry.wasReady) { this.terminate(entry, error); return; }
        const wasAvailable = entry.available;
        if (wasAvailable) entry.lossReason = error.message;
        entry.lossCause = new Error(error.message);
        entry.available = false;
        entry.generation++;
        entry.controller.abort();
        if (entry.timer) clearTimeout(entry.timer);
        if (entry.connection) {
            void this.scheduleClose(entry, entry.connection).catch(() => {});
            entry.connection = undefined;
        }
        if (!wasAvailable) return; // The running retry owns its next attempt.
        const gate = readiness();
        entry.readiness = gate.promise;
        entry.resolveReady = gate.resolve;
        entry.rejectReady = gate.reject;
        void this.recover(entry);
    }

    private async recover(entry: Entry): Promise<void> {
        while (!entry.dead && entry.leases.size) {
            const delay = this.delays[entry.retries++];
            if (delay === undefined) {
                this.terminate(entry, new Error(`${entry.lossReason ?? 'PostgreSQL change listener lost: connection failure'} (tenant '${entry.tenant}', recovery exhausted)`,
                    { cause: entry.lossCause }));
                return;
            }
            try {
                await new Promise<void>(resolve => {
                    entry.retryWake = resolve;
                    entry.retryTimer = setTimeout(resolve, delay);
                });
                entry.retryWake = undefined;
                if (entry.dead) return;
                entry.controller = new AbortController();
                await this.start(entry);
                const generation = entry.generation;
                // Re-resolve every live reader mapping: neither a new pool search_path nor a replaced
                // trigger may silently redirect a pre-existing observation.
                for (const lease of [...entry.leases]) {
                    if (lease.released || !lease.key) continue;
                    await this.revalidateLease(entry, lease, generation);
                }
                this.completeRecovery(entry, generation);
                return;
            } catch (error) {
                if (entry.dead) return;
                this.handleRecoveryFailure(entry, error);
                // A failed attempt never resets the retry budget; a successful heartbeat does.
            }
        }
    }

    private handleRecoveryFailure(entry: Entry, error: unknown): void {
        if (!entry.controller.signal.aborted)
            this.lost(entry, error instanceof ReaderRevalidationError ? error : new Error('PostgreSQL change listener lost: recovery attempt failed'));
    }

    private async revalidateLease(entry: Entry, lease: Lease, generation: number): Promise<void> {
        try {
            const identity = await this.bounded(entry, () => resolvePostgreSQLTable(lease.database, lease.table, entry.tenant), undefined, false);
            this.requireExistingMapping(entry, lease, identity);
            const listenerDatabase = await this.bounded(entry, () => entry.connection!.query('SELECT current_database() AS database')
                .catch(error => { this.listenerDatabaseFailed(entry, generation, error); }));
            if (listenerDatabase.rows[0]?.database !== identity.database)
                throw new DefinitivePostgreSQLObservationError(this.mappingFailure(entry));
            await this.validate(entry, identity);
            if (entry.controller.signal.aborted) throw new Error('PostgreSQL listener operation timed out');
            if (!lease.released && !entry.dead) entry.identities.set(lease.table, identity);
        } catch (error) {
            this.handleRevalidationFailure(entry, lease, error);
        }
    }

    private requireExistingMapping(entry: Entry, lease: Lease, identity: PostgreSQLTableIdentity): void {
        const existing = { key: lease.key!, database: entry.identities.get(lease.table)?.database };
        if (this.mappingDiffers(identity, existing))
            throw new DefinitivePostgreSQLObservationError(this.mappingFailure(entry));
    }

    private listenerDatabaseFailed(entry: Entry, generation: number, error: unknown): never {
        if (this.isLiveGeneration(entry, generation))
            this.lost(entry, new Error('PostgreSQL change listener lost: database verification failure'));
        throw error;
    }

    private handleRevalidationFailure(entry: Entry, lease: Lease, error: unknown): void {
        if (entry.controller.signal.aborted) throw error;
        // Only an outcome a retry cannot change fails the observation; a pool error or
        // reader timeout spends a bounded retry like any other failed attempt.
        if (error instanceof DefinitivePostgreSQLObservationError) {
            if (!lease.released) lease.fail(error);
            return;
        }
        throw new ReaderRevalidationError('PostgreSQL change listener lost: reader revalidation failure', { cause: error });
    }

    private completeRecovery(entry: Entry, generation: number): void {
        if (entry.dead || generation !== entry.generation || !entry.leases.size) return;
        entry.available = true;
        entry.lossReason = undefined;
        entry.lossCause = undefined;
        entry.resolveReady(generation);
        this.heartbeat(entry);
        for (const lease of [...entry.leases]) if (!lease.released && lease.key) lease.changed(true);
    }

    private terminate(entry: Entry, error: Error): void {
        if (entry.dead) return;
        const leases = [...entry.leases];
        // Retire the entry before callbacks can synchronously resubscribe.
        entry.rejectReady(error);
        this.shutdown(entry);
        for (const lease of leases) if (!lease.released) lease.fail(error);
    }

    private shutdown(entry: Entry, complete = false): void {
        if (entry.dead) return;
        const leases = complete ? [...entry.leases] : [];
        entry.dead = true;
        entry.generation++;
        this.cancelEntry(entry);
        entry.rejectReady(new Error('Drizzle observation was closed'));
        entry.routing.clear(); entry.identities.clear();
        for (const lease of leases) if (!lease.released) lease.complete?.();
        if (this.#entries.get(entry.tenant) === entry) this.#entries.delete(entry.tenant);
        if (entry.connection) this.scheduleClose(entry, entry.connection);
    }

    private cancelEntry(entry: Entry): void {
        entry.controller.abort();
        if (entry.timer) clearTimeout(entry.timer);
        if (entry.retryTimer) clearTimeout(entry.retryTimer);
        entry.retryWake?.();
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
            error => {
                this.#closing.delete(closing);
                if (this.#closeFailures.length < 32) this.#closeFailures.push(error);
                else this.#discardedCloseFailures++;
            });
        return closing;
    }

    /** Dispose all Arc-owned sockets, including shutdowns already scheduled by RxJS teardown. */
    [Symbol.asyncDispose](): Promise<void> {
        if (this.#disposal) return this.#disposal;
        this.#disposed = true;
        for (const entry of [...this.#entries.values()]) this.shutdown(entry, true);
        this.#disposal = this.drainCloses();
        // Disposal may be initiated without awaiting it. Keep the rejection available to an awaiting
        // caller, but do not let a close failure become an unhandled rejection in that case.
        void this.#disposal.catch(() => {});
        return this.#disposal;
    }

    private async drainCloses(): Promise<void> {
        // A factory that ignores abort cannot block disposal indefinitely. Its eventual result is still closed.
        let factoryDeadlineExpired = false;
        let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
        const factoryDeadline = new Promise<void>(resolve => {
            deadlineTimer = setTimeout(() => { factoryDeadlineExpired = true; resolve(); }, this.operationTimeoutMs);
        });
        try {
            while (this.#closing.size || (this.#pendingFactories.size && !factoryDeadlineExpired)) {
                await Promise.allSettled([
                    ...this.#closing,
                    ...(!factoryDeadlineExpired ? [...this.#pendingFactories].map(factory => Promise.race([factory, factoryDeadline])) : [])
                ]);
            }
            const failures = this.#closeFailures.splice(0);
            if (this.#discardedCloseFailures) {
                failures.push(new Error(`${this.#discardedCloseFailures} additional PostgreSQL listener close failures`));
                this.#discardedCloseFailures = 0;
            }
            if (failures.length) throw new AggregateError(failures, 'PostgreSQL listener shutdown failed');
        } finally { clearTimeout(deadlineTimer); }
    }
}
