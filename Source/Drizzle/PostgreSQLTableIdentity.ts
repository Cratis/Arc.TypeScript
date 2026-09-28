// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { is, sql } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDatabase } from './DrizzleDatabase.js';

/** Internal reader-derived physical relation name; never infer search_path from the listener. */
export interface PostgreSQLTableIdentity { readonly key: string; readonly database: string; readonly oid: string; readonly schema: string; }

/** An observation outcome that retrying cannot change, such as a missing relation or an invalid trigger. */
export class DefinitivePostgreSQLObservationError extends Error {}

/** Normalize the row-array postgres.js and node-postgres QueryResult shapes. */
export function postgresqlRows(result: unknown): Record<string, unknown>[] {
    const rows = Array.isArray(result) ? result : (result as { rows?: unknown })?.rows;
    if (!Array.isArray(rows)) throw new Error('PostgreSQL reader returned no catalog rows');
    return rows as Record<string, unknown>[];
}

/** Resolve through the reader's own Drizzle connection and search_path. */
export async function resolvePostgreSQLTable(database: DrizzleDatabase, table: Table, tenant: string): Promise<PostgreSQLTableIdentity> {
    if (!is(table, PgTable)) throw new DefinitivePostgreSQLObservationError('PostgreSQL observation requires a PostgreSQL table');
    if ((table as unknown as { [key: symbol]: unknown })[Symbol.for('drizzle:IsAlias')])
        throw new DefinitivePostgreSQLObservationError('PostgreSQL observation does not support aliased tables; register the base table');
    const config = getTableConfig(table as PgTable);
    const quote = (name: string): string => `"${name.replaceAll('"', '""')}"`;
    const name = config.schema ? `${quote(config.schema)}.${quote(config.name)}` : quote(config.name);
    let result: unknown;
    try {
        result = await (database as { execute(query: ReturnType<typeof sql>): Promise<unknown> }).execute(sql`
            SELECT c.oid::text AS oid, pg_catalog.format('%I.%I', n.nspname, c.relname) AS key,
                   current_database() AS database, c.relkind AS kind, n.nspname AS schema,
                   c.relispartition OR EXISTS (SELECT 1 FROM pg_catalog.pg_inherits i WHERE i.inhrelid = c.oid OR i.inhparent = c.oid) AS inherited
            FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE c.oid = pg_catalog.to_regclass(${name})`);
    } catch (error) {
        throw new Error(`PostgreSQL observation could not resolve table '${config.name}' for tenant '${tenant}'; check the reader search_path`, { cause: error });
    }
    const row = postgresqlRows(result)[0];
    if (!row || !['r'].includes(String(row.kind)) || String(row.schema).startsWith('pg_temp_'))
        throw new DefinitivePostgreSQLObservationError(`PostgreSQL observation could not resolve table '${config.name}' for tenant '${tenant}'; check the reader search_path`);
    // A statement trigger fires only on the table a write names: writes through a parent miss a child's trigger,
    // and writes to a child miss the trigger of a parent whose reads include the child's rows.
    if (row.inherited === true || row.inherited === 't')
        throw new DefinitivePostgreSQLObservationError(`PostgreSQL observation does not support partitions or inheritance; table '${config.name}' for tenant '${tenant}' takes part in an inheritance hierarchy`);
    return { key: String(row.key), oid: String(row.oid), database: String(row.database), schema: String(row.schema) };
}
