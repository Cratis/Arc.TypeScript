// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, DateOnly, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';

/** Explicit conversion for a Drizzle custom column; never relies on process-wide conventions. */
export interface ColumnCodec<T, Driver = string> {
    readonly sqlType: string;
    toDriver(value: T): Driver;
    fromDriver(value: Driver): T;
}

/** String, finite number and UUID-backed concepts retain their concrete runtime type. */
export function conceptCodec<V extends string | number | Guid, T extends ConceptAs<V>>(
    type: new (value: V) => T, value: V extends Guid ? 'guid' : V extends number ? 'number' : 'string',
    dialect: 'postgresql' | 'mysql' | 'sqlite'
): ColumnCodec<T, string | number> {
    const guid = guidCodec(dialect);
    return {
        sqlType: value === 'number' ? dialect === 'sqlite' ? 'real' : 'double precision' :
            value === 'guid' ? guid.sqlType : 'text',
        toDriver(concept) {
            const primitive = concept.value;
            if (value === 'number') {
                if (typeof primitive !== 'number' || !Number.isFinite(primitive)) throw new TypeError('Concept number must be finite');
                return primitive;
            }
            if (value === 'guid') return guid.toDriver(primitive instanceof Guid ? primitive : Guid.parse(String(primitive)));
            if (typeof primitive !== 'string') throw new TypeError('Concept string is required');
            return primitive;
        },
        fromDriver(raw) {
            const primitive = value === 'guid' ? guid.fromDriver(String(raw)) : raw;
            if (value === 'number' && (typeof primitive !== 'number' || !Number.isFinite(primitive)))
                throw new TypeError('Concept number must be finite');
            return new type(primitive as V);
        }
    };
}

/** PostgreSQL UUID; MySQL/SQLite canonical CHAR(36)/TEXT instead of EF's SQLite BLOB mismatch. */
export function guidCodec(dialect: 'postgresql' | 'mysql' | 'sqlite'): ColumnCodec<Guid> {
    return { sqlType: dialect === 'postgresql' ? 'uuid' : dialect === 'mysql' ? 'char(36)' : 'text',
        toDriver: value => {
            if (!(value instanceof Guid)) throw new TypeError('Guid is required');
            return value.toString();
        },
        fromDriver: value => Guid.parse(value) };
}

/** ISO date-only values do not acquire a time zone. */
export const dateOnlyCodec: ColumnCodec<DateOnly> = {
    sqlType: 'date', toDriver: value => value.toString(), fromDriver: value => DateOnly.parse(value)
};
/** ISO time-of-day without a date or time zone. */
export const timeOnlyCodec: ColumnCodec<TimeOnly> = {
    sqlType: 'time', toDriver: value => value.toString(), fromDriver: value => TimeOnly.parse(value)
};
/** Duration stored as text to avoid provider-dependent interval precision. */
export const timeSpanCodec: ColumnCodec<TimeSpan> = {
    sqlType: 'text', toDriver: value => value.toString(), fromDriver: value => TimeSpan.parse(value)
};
/** JSON/JSONB conversions with application-owned runtime validation for untrusted stored content. */
export function jsonCodec<T>(dialect: 'postgresql' | 'mysql' | 'sqlite', validate: (value: unknown) => T): ColumnCodec<T, string | unknown> {
    return { sqlType: dialect === 'postgresql' ? 'jsonb' : dialect === 'mysql' ? 'json' : 'text',
        toDriver: value => JSON.stringify(value),
        fromDriver: raw => validate(typeof raw === 'string' ? JSON.parse(raw) as unknown : raw) };
}
