// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, DateOnly, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import { fieldsFor } from '@cratis/arc.core';
import type { WireField } from '@cratis/arc.core';
import type { Column } from 'drizzle-orm';

/** Materialize declared Arc fields after Drizzle has decoded each column's driver value. */
export class DrizzleModelCodec<T extends object> {
    private readonly fields: readonly WireField[];
    readonly selection: Record<string, Column>;
    readonly sortableFields: ReadonlySet<string>;
    constructor(private readonly type: new () => T, private readonly columns: Record<string, Column>) {
        this.fields = fieldsFor(type);
        if (!this.fields.length) throw new Error(`Drizzle model ${type.name} requires @field metadata`);
        this.selection = {};
        this.sortableFields = new Set(this.fields.map(field => field.name));
        for (const field of this.fields) {
            if (!Object.hasOwn(columns, field.name))
                throw new Error(`Drizzle model ${type.name} has no column for field: ${field.name}`);
            this.selection[field.name] = columns[field.name]!;
        }
        for (const [name, column] of Object.entries(columns)) {
            if (column.primary) this.selection[name] = column;
        }
    }
    /** Keep SQL column mappings explicit while using Arc metadata for the model's runtime value types. */
    deserialize(row: Record<string, unknown>): T {
        const model = new this.type();
        for (const field of this.fields) {
            const raw = row[field.name];
            if (raw === undefined) throw new Error(`Drizzle row is missing field: ${field.name}`);
            // Drizzle's select builder already maps driver values through the column codec.
            Reflect.set(model, field.name, raw == null || field.type !== String && field.type !== Number && field.type !== Boolean &&
                field.type !== Date && raw instanceof field.type ? raw : this.convert(field, raw));
        }
        return model;
    }
    /** Convert a command key to the type expected by its Drizzle column. */
    keyValue(name: string, key: string): unknown {
        const field = this.fields.find(candidate => candidate.name === name);
        if (!field) throw new Error(`Drizzle model ${this.type.name} requires @field metadata for primary key: ${name}`);
        const valueType = field.type.prototype instanceof ConceptAs ? field.type.valueType : field.type;
        let primitive: unknown = key;
        if (valueType === Number) {
            const number = Number(key);
            if (!/^-?\d+$/.test(key) || !Number.isSafeInteger(number)) throw new TypeError('Invalid Drizzle number key');
            primitive = number;
        } else if (valueType === Guid) {
            if (!Guid.isGuid(key)) throw new TypeError('Invalid Drizzle Guid key');
            primitive = Guid.parse(key);
        } else if (valueType === Date) {
            primitive = new Date(key);
        }
        const typed = this.convert(field, primitive);
        if (this.columns[name]!.columnType.endsWith('CustomColumn')) return typed;
        const unwrapped = typed instanceof ConceptAs ? typed.value : typed;
        return unwrapped instanceof Guid ? unwrapped.toString() : unwrapped;
    }
    private convert(field: WireField, value: unknown): unknown {
        if (field.type === String || field.type === Number || field.type === Boolean || field.type === Date) {
            const matches = field.type === String ? typeof value === 'string' :
                field.type === Number ? typeof value === 'number' && Number.isFinite(value) :
                    field.type === Boolean ? typeof value === 'boolean' : value instanceof Date && !Number.isNaN(value.getTime());
            if (!matches) throw new TypeError(`Drizzle field ${field.name} requires ${field.type.name}`);
            return value;
        }
        if (field.type === Guid) return Guid.parse(String(value));
        if (field.type === DateOnly) return DateOnly.parse(String(value));
        if (field.type === TimeOnly) return TimeOnly.parse(String(value));
        if (field.type === TimeSpan) return TimeSpan.parse(String(value));
        if (field.type.prototype instanceof ConceptAs) {
            const expected = field.type.valueType;
            if (expected !== Guid && expected !== Number && expected !== String)
                throw new TypeError(`Drizzle concept ${field.type.name} requires static valueType`);
            const primitive = expected === Guid && !(value instanceof Guid) ? Guid.parse(String(value)) : value;
            if (expected === Number && (typeof primitive !== 'number' || !Number.isFinite(primitive)) ||
                expected === String && typeof primitive !== 'string' ||
                expected === Guid && !(primitive instanceof Guid))
                throw new TypeError(`Drizzle field ${field.name} requires ${expected?.name}`);
            return Reflect.construct(field.type, [primitive]);
        }
        return value;
    }
}
