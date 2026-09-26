// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { pgTable, text } from 'drizzle-orm/pg-core';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';
import type { PostgreSQLListenerConnection } from '../../PostgreSQLListenerConnection.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';

export const table = pgTable('tasks', { id: text('id').primaryKey() });
export const row = { oid: '12', key: 'app.tasks', database: 'arc', kind: 'r', schema: 'app' };
export const database = { execute: async () => [row] } as DrizzleDatabase;
export const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
export const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export class Listener implements PostgreSQLListenerConnection {
    notification?: (channel: string, payload?: string) => void;
    disconnect?: (error?: Error) => void;
    closeCount = 0;
    async connect(): Promise<void> {}
    async query(statement: string): Promise<{ rows: Record<string, unknown>[] }> {
        if (statement.includes('current_database')) return { rows: [{ database: 'arc' }] };
        if (statement.includes('pg_trigger')) return { rows: [{ tgtype: 60, tgenabled: 'O', no_predicate: true,
            attributes: '', tgisinternal: false, constraint_oid: '0', tgnargs: 1,
            arguments: '6172635f6368616e67657300', proname: 'arc_notify_changes_v1', pronargs: 0,
            returns_trigger: true, lanname: 'plpgsql', function_schema: 'app' }] };
        return { rows: [] };
    }
    onNotification(listener: (channel: string, payload?: string) => void): void { this.notification = listener; }
    onDisconnect(listener: (error?: Error) => void): void { this.disconnect = listener; }
    async close(): Promise<void> { this.closeCount++; }
}
export const managerFor = (listener: () => PostgreSQLListenerConnection | Promise<PostgreSQLListenerConnection>, timeout = 100) =>
    new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify, listener }, 60_000, timeout);
