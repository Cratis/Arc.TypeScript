// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
import { getTableName } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';

/** Application-local, tenant-isolated change bus. Table keys are registered object identities. */
export class DrizzleChangeNotifications {
    readonly #listeners = new Map<string, Map<Table, Set<() => void>>>();
    readonly #frames = new AsyncLocalStorage<{ tenant: string; pending: Set<Table>; active: boolean }>();
    constructor(private readonly tables: ReadonlyMap<new () => object, Table>, private readonly enabled: boolean) {}

    /** Validate even in disabled mode, then queue within a command or publish immediately. */
    notify(tenant: string, targets: readonly (Table | (new () => object))[]): void {
        const resolved = targets.map(target => {
            const table = this.tables.get(target as new () => object) ?? target as Table;
            if (![...this.tables.values()].includes(table)) {
                let name: string;
                try { name = typeof target === 'function' ? target.name : getTableName(target as Table); }
                catch { name = target?.constructor?.name ?? 'unknown'; }
                throw new Error(`Unknown Drizzle read-model table: ${name}`);
            }
            return table;
        });
        if (!this.enabled) return;
        const frame = this.#frames.getStore();
        if (frame?.active && frame.tenant === tenant) {
            for (const table of resolved) frame.pending.add(table);
        } else for (const table of new Set(resolved)) this.publish(tenant, table);
    }

    /** Nested calls for this tenant join the ambient frame; independent calls never share one. */
    async run<T>(tenant: string, execute: () => Promise<T>): Promise<T> {
        const active = this.#frames.getStore();
        if (active?.active && active.tenant === tenant) return execute();
        const frame = { tenant, pending: new Set<Table>(), active: true };
        return this.#frames.run(frame, async () => {
            try { return await execute(); }
            finally {
                frame.active = false;
                for (const table of frame.pending) this.publish(tenant, table);
                frame.pending.clear();
            }
        });
    }

    listen(tenant: string, table: Table, listener: () => void): () => void {
        let tables = this.#listeners.get(tenant);
        if (!tables) { tables = new Map(); this.#listeners.set(tenant, tables); }
        let listeners = tables.get(table);
        if (!listeners) { listeners = new Set(); tables.set(table, listeners); }
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
            if (!listeners.size) tables.delete(table);
            if (!tables.size) this.#listeners.delete(tenant);
        };
    }

    listenerCount(tenant: string): number {
        return [...(this.#listeners.get(tenant)?.values() ?? [])].reduce((sum, listeners) => sum + listeners.size, 0);
    }

    private publish(tenant: string, table: Table): void {
        for (const listener of [...(this.#listeners.get(tenant)?.get(table) ?? [])]) listener();
    }
}
