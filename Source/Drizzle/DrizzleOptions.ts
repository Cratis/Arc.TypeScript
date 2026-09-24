// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '@cratis/arc.core';
import type { Table } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

/** Minimal SQL execution surface supported by the PostgreSQL, MySQL, and SQLite Drizzle drivers. */
export type DrizzleDatabase = object;
/** Storage location is selected for each Arc execution, never from a caller-supplied query argument. */
export interface DrizzleOptions {
    dialect: 'postgresql' | 'mysql' | 'sqlite';
    /** Only valid for the default tenant; applications own this pool/connection and its disposal. */
    database?: DrizzleDatabase;
    /** Return a tenant-specific pool/connection. The application owns caching and disposal. */
    databaseFactory?: (tenant: string, context: ExecutionContext) => DrizzleDatabase | Promise<DrizzleDatabase>;
    readModels?: readonly { type: new () => object; table: Table }[];
    maxPageSize?: number;
}
/** A typed SQL predicate authored by the application, not interpolated request text. */
export type DrizzleFilter = SQL | undefined;
