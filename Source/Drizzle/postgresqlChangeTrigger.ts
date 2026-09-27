// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { is } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';

/** Experimental PostgreSQL migration helper options; the schema is mandatory for schema-less tables. */
export interface PostgreSQLChangeTriggerOptions { schema?: string; }

function identifier(value: string): string {
    if (!value || Buffer.byteLength(value, 'utf8') > 63 || value.includes('\0'))
        throw new Error('Invalid PostgreSQL migration identifier');
    return `"${value.replaceAll('"', '""')}"`;
}

/** Experimental: return application-owned migration SQL; does not connect or install a trigger. */
export function postgresqlChangeTrigger(table: Table, options: PostgreSQLChangeTriggerOptions = {}): string {
    if (!is(table, PgTable)) throw new Error('PostgreSQL change trigger requires a PostgreSQL base table');
    if ((table as unknown as { [key: symbol]: unknown })[Symbol.for('drizzle:IsAlias')])
        throw new Error('PostgreSQL change trigger does not support aliased tables; use the base table');
    const config = getTableConfig(table as PgTable);
    if (config.schema && options.schema && config.schema !== options.schema)
        throw new Error('PostgreSQL change trigger schema conflicts with the declared table schema');
    const schema = config.schema ?? options.schema;
    if (!schema) throw new Error('PostgreSQL change trigger requires an explicit migration schema');
    const relation = `${identifier(schema)}.${identifier(config.name)}`;
    const functionName = `${identifier(schema)}."arc_notify_changes_v1"`;
    return `CREATE OR REPLACE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $arc$\nBEGIN\n    PERFORM pg_catalog.pg_notify(TG_ARGV[0], format('%I.%I', TG_TABLE_SCHEMA, TG_TABLE_NAME));\n    RETURN NULL;\nEND;\n$arc$;\nCREATE TRIGGER "arc_changes_v1" AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON ${relation} FOR EACH STATEMENT EXECUTE FUNCTION ${functionName}('arc_changes');`;
}
