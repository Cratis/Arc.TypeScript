// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DrizzleDialect } from './DrizzleDialect.js';
import type { ExecutionContext } from '@cratis/arc.core';
import type { Table } from 'drizzle-orm';
import type { DrizzleDatabase } from './DrizzleDatabase.js';
import type { DrizzleObservation } from './DrizzleObservation.js';

/** Storage location is selected for each Arc execution, never from a caller-supplied query argument. */
export interface DrizzleOptions {
    dialect: DrizzleDialect;
    /** Only valid for the default tenant; applications own this pool/connection and its disposal. */
    database?: DrizzleDatabase;
    /** Return a tenant-specific pool/connection. The application owns caching and disposal. */
    databaseFactory?: (tenant: string, context: ExecutionContext) => DrizzleDatabase | Promise<DrizzleDatabase>;
    readModels?: readonly { type: new () => object; table: Table }[];
    maxPageSize?: number;
    /** Experimental: receive only changes explicitly announced in this process. */
    observation?: DrizzleObservation;
}
