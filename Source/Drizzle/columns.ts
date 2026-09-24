// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { customType as pgCustomType } from 'drizzle-orm/pg-core';
import { customType as mysqlCustomType } from 'drizzle-orm/mysql-core';
import { customType as sqliteCustomType } from 'drizzle-orm/sqlite-core';
import type { ColumnCodec } from './ColumnCodec.js';

/** Use a codec in PostgreSQL schema definitions; SQL types are declared by the codec. */
export function pgColumn<T, Driver = string>(codec: ColumnCodec<T, Driver>) {
    return pgCustomType<{ data: T; driverData: Driver }>({
        dataType: () => codec.sqlType,
        toDriver: value => codec.toDriver(value),
        fromDriver: value => codec.fromDriver(value)
    });
}
/** Use a codec in MySQL schema definitions. */
export function mysqlColumn<T, Driver = string>(codec: ColumnCodec<T, Driver>) {
    return mysqlCustomType<{ data: T; driverData: Driver }>({
        dataType: () => codec.sqlType,
        toDriver: value => codec.toDriver(value),
        fromDriver: value => codec.fromDriver(value)
    });
}
/** Use a codec in SQLite schema definitions. */
export function sqliteColumn<T, Driver = string>(codec: ColumnCodec<T, Driver>) {
    return sqliteCustomType<{ data: T; driverData: Driver }>({
        dataType: () => codec.sqlType === 'date' || codec.sqlType === 'time' ? 'text' : codec.sqlType,
        toDriver: value => codec.toDriver(value),
        fromDriver: value => codec.fromDriver(value)
    });
}
