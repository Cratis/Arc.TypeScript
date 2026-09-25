// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DrizzleDialect } from './DrizzleDialect.js';
import { ConceptCodecKind } from './ConceptCodecKind.js';
import { ConceptAs, DateOnly, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';

/** Explicit conversion for a Drizzle custom column; never relies on process-wide conventions. */
export interface ColumnCodec<T, Driver = string> {
    readonly sqlType: string;
    toDriver(value: T): Driver;
    fromDriver(value: Driver): T;
}

/** String, finite number and UUID-backed concepts retain their concrete runtime type. */
export function conceptCodec<V extends string | number | Guid, T extends ConceptAs<V>>(
    type: (new (value: V) => T) & { readonly valueType: typeof Guid | typeof Number | typeof String },
    kind: V extends Guid ? ConceptCodecKind.Guid : V extends number ? ConceptCodecKind.Number : ConceptCodecKind.String,
    dialect: DrizzleDialect, varcharLength?: number
): ColumnCodec<T, string | number> {
    const expected = kind === ConceptCodecKind.Guid ? Guid : kind === ConceptCodecKind.Number ? Number : String;
    if (type.valueType !== expected) throw new TypeError(`Concept ${type.name} does not match ${kind}`);
    if (varcharLength !== undefined && (dialect !== DrizzleDialect.MySQL || kind !== ConceptCodecKind.String ||
        !Number.isSafeInteger(varcharLength) || varcharLength < 1 || varcharLength > 65535))
        throw new RangeError('varcharLength requires a MySQL string concept and a length between 1 and 65535');
    const guid = guidCodec(dialect);
    return {
        sqlType: kind === ConceptCodecKind.Number ? dialect === DrizzleDialect.SQLite ? 'real' : dialect === DrizzleDialect.MySQL
            ? 'double' : 'double precision' :
            kind === ConceptCodecKind.Guid ? guid.sqlType : varcharLength ? `varchar(${varcharLength})` : 'text',
        toDriver(concept) {
            const primitive = concept.value;
            if (kind === ConceptCodecKind.Number) {
                if (typeof primitive !== 'number' || !Number.isFinite(primitive)) throw new TypeError('Concept number must be finite');
                return primitive;
            }
            if (kind === ConceptCodecKind.Guid) return guid.toDriver(primitive instanceof Guid ? primitive : Guid.parse(String(primitive)));
            if (typeof primitive !== 'string') throw new TypeError('Concept string is required');
            return primitive;
        },
        fromDriver(raw) {
            const primitive = kind === ConceptCodecKind.Guid ? guid.fromDriver(String(raw)) : raw;
            if (kind === ConceptCodecKind.Number && (typeof primitive !== 'number' || !Number.isFinite(primitive)))
                throw new TypeError('Concept number must be finite');
            if (kind === ConceptCodecKind.String && typeof primitive !== 'string') throw new TypeError('Concept string is required');
            return new type(primitive as V);
        }
    };
}

/** PostgreSQL UUID; MySQL/SQLite canonical CHAR(36)/TEXT instead of EF's SQLite BLOB mismatch. */
export function guidCodec(dialect: DrizzleDialect): ColumnCodec<Guid> {
    return { sqlType: dialect === DrizzleDialect.PostgreSQL ? 'uuid' : dialect === DrizzleDialect.MySQL ? 'char(36)' : 'text',
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
export function jsonCodec<T>(dialect: DrizzleDialect, validate: (value: unknown) => T): ColumnCodec<T, string | unknown> {
    return { sqlType: dialect === DrizzleDialect.PostgreSQL ? 'jsonb' : dialect === DrizzleDialect.MySQL ? 'json' : 'text',
        toDriver: value => JSON.stringify(value),
        fromDriver: raw => validate(typeof raw === 'string' ? JSON.parse(raw) as unknown : raw) };
}
