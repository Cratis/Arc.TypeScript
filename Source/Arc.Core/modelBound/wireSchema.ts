// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, DateOnly, Fields, Guid, TimeOnly, TimeSpan, type Field } from '@cratis/fundamentals';
import { z } from 'zod';
import { readFieldOptions, type FieldOptions, type WireType } from './metadata.js';

export interface WireField { readonly name: string; readonly type: WireType; readonly element?: WireType; readonly options: FieldOptions }
const guidSchema = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
const dateSchema = z.string().refine(value => !Number.isNaN(Date.parse(value)) && /^\d{4}-\d\d-\d\dT/.test(value));
const dateOnlySchema = z.string().regex(/^\d{4}-\d\d-\d\d$/);
const timeOnlySchema = z.string().regex(/^\d\d:\d\d(?::\d\d)?(?:\.\d{1,7})?$/);
const timeSpanSchema = z.string().regex(/^-?(?:\d+\.)?\d{1,2}:\d\d:\d\d(?:\.\d{1,7})?$/);

export function fieldsFor(type: WireType): WireField[] {
    return Fields.getFieldsForType(type as never).map((field: Field) => ({
        name: field.name,
        type: field.type,
        element: field.type === Array ? field.genericArguments[0] : field.enumerable ? field.type : undefined,
        options: readFieldOptions(type, field.name)
    }));
}
export function schemaFor(type: WireType, options: FieldOptions = {}, element?: WireType): z.ZodType {
    let schema: z.ZodType;
    if (element || type === Array) {
        if (!element) throw new Error('Array fields require an element type');
        schema = z.array(schemaFor(element));
    } else if (type === String) schema = z.string();
    else if (type === Number) schema = z.number().finite();
    else if (type === Boolean) schema = z.boolean();
    else if (type === Guid) schema = guidSchema;
    else if (type === Date) schema = dateSchema;
    else if (type === DateOnly) schema = dateOnlySchema;
    else if (type === TimeOnly) schema = timeOnlySchema;
    else if (type === TimeSpan) schema = timeSpanSchema;
    else if (type.prototype instanceof ConceptAs) {
        if (!type.valueType) throw new Error(`Concept ${type.name} requires static valueType`);
        schema = schemaFor(type.valueType);
    } else if (fieldsFor(type).length) schema = z.lazy(() => objectSchema(type));
    else throw new Error(`Unsupported Arc wire type: ${type.name}`);
    if (options.values) {
        if (!options.values.length) throw new Error(`Enumeration for ${type.name} requires values`);
        const literals = options.values.map(value => z.literal(value));
        schema = literals.length === 1 ? literals[0]! : z.union(literals as [z.ZodLiteral<string | number | boolean>, z.ZodLiteral<string | number | boolean>, ...z.ZodLiteral<string | number | boolean>[]]);
    }
    if (options.nullable) schema = schema.nullable();
    if (Object.hasOwn(options, 'defaultValue')) schema = schema.default(options.defaultValue);
    else if (options.optional) schema = schema.optional();
    return schema;
}
export function objectSchema(type: WireType): z.ZodObject<z.ZodRawShape> {
    const shape: Record<string, z.ZodType> = {};
    for (const field of fieldsFor(type)) shape[field.name] = schemaFor(field.type, field.options, field.element);
    return z.object(shape);
}
export function decode(type: WireType, value: unknown, element?: WireType): unknown {
    if (value === null || value === undefined) return value;
    if (element) return (value as unknown[]).map(item => decode(element, item));
    if (type === Guid) return Guid.parse(value as string);
    if (type === Date) return new Date(value as string);
    if (type === DateOnly) return DateOnly.parse(value as string);
    if (type === TimeOnly) return TimeOnly.parse(value as string);
    if (type === TimeSpan) return TimeSpan.parse(value as string);
    if (type.prototype instanceof ConceptAs) {
        if (!type.valueType) throw new Error(`Concept ${type.name} requires static valueType`);
        return Reflect.construct(type, [decode(type.valueType, value)]);
    }
    if (type === Array) throw new Error('Array fields require an element type');
    if (type === String || type === Number || type === Boolean) return value;
    const instance = Reflect.construct(type, []) as Record<string, unknown>;
    for (const field of fieldsFor(type)) {
        if (Object.hasOwn(value as object, field.name)) instance[field.name] = decode(field.type, (value as Record<string, unknown>)[field.name], field.element);
    }
    return instance;
}
export function encode(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (value instanceof ConceptAs) return encode(value.value);
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Guid || value instanceof DateOnly || value instanceof TimeOnly || value instanceof TimeSpan) return value.toString();
    if (Array.isArray(value)) return value.map(encode);
    if (typeof value === 'object') {
        const fields = fieldsFor(value.constructor as WireType);
        const entries = fields.length ? fields.map(field => [field.name, Reflect.get(value, field.name)] as const) : Object.entries(value);
        return Object.fromEntries(entries.filter(([, item]) => item !== undefined).map(([name, item]) => [name, encode(item)]));
    }
    return value;
}
