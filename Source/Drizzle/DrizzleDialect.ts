// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** SQL dialect used by a Drizzle read-model provider. */
export enum DrizzleDialect {
    /** PostgreSQL dialect. */
    PostgreSQL = 'postgresql',
    /** MySQL dialect. */
    MySQL = 'mysql',
    /** SQLite dialect. */
    SQLite = 'sqlite'
}
