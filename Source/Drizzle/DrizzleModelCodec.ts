// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, DateOnly, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import { fieldsFor } from '@cratis/arc.core';
import type { WireField } from '@cratis/arc.core';
import type { Column } from 'drizzle-orm';

/** Materialize declared Arc fields after Drizzle has decoded each column's driver value. */
export class DrizzleModelCodec<T extends object> {
    private readonly fields: readonly WireField[];
    constructor(private readonly type: new () => T, private readonly columns: Record<string, Column>) {
        this.fields = fieldsFor(type);
        if (!this.fields.length) throw new Error(`Drizzle model ${type.name} requires @field metadata`);
        for (const field of this.fields) {
            if (!Object.hasOwn(columns, field.name))
                throw new Error(`Drizzle model ${type.name} has no column for field: ${field.name}`);
        }
    }
    /** Keep SQL column mappings explicit while using Arc metadata for the model's runtime value types. */
    deserialize(row: Record<string, unknown>): T {
        const model = new this.type();
        for (const field of this.fields) {
            const raw = row[field.name];
            if (raw === undefined) throw new Error(`Drizzle row is missing field: ${field.name}`);
            const value = raw == null ? raw : this.columns[field.name]!.mapFromDriverValue(raw);
            Reflect.set(model, field.name, value == null || value instanceof field.type ? value : this.convert(field, value));
        }
        return model;
    }
    private convert(field: WireField, value: unknown): unknown {
        if (field.type === Guid) return Guid.parse(String(value));
        if (field.type === DateOnly) return DateOnly.parse(String(value));
        if (field.type === TimeOnly) return TimeOnly.parse(String(value));
        if (field.type === TimeSpan) return TimeSpan.parse(String(value));
        if (field.type.prototype instanceof ConceptAs) {
            const primitive = field.type.valueType === Guid && !(value instanceof Guid) ? Guid.parse(String(value)) : value;
            return Reflect.construct(field.type, [primitive]);
        }
        return value;
    }
}
