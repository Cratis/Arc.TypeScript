// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, DateOnly, DerivedType, Fields, Guid, TimeOnly, TimeSpan, type Field } from '@cratis/fundamentals';
import { z } from 'zod';
import { isArcTuple } from '../commands/ArcTuple.js';
import { isQueryPage, queryPage } from '../queries/QueryPage.js';
import { readFieldOptions } from './readFieldOptions.js';
import type { FieldOptions } from './FieldOptions.js';
import type { WireType } from './WireType.js';
import type { WireField } from './WireField.js';
const guidSchema = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
    .meta({ format: 'uuid' });
const dateSchema = z.string().refine(value => !Number.isNaN(Date.parse(value)) && /^\d{4}-\d\d-\d\dT/.test(value))
    .meta({ format: 'date-time' });
const dateOnlySchema = z.string().regex(/^\d{4}-\d\d-\d\d$/).meta({ format: 'date' });
const timeOnlySchema = z.string().regex(/^\d\d:\d\d(?::\d\d)?(?:\.\d{1,7})?$/).meta({ format: 'time' });
const timeSpanSchema = z.string().regex(/^-?(?:\d+\.)?\d{1,2}:\d\d:\d\d(?:\.\d{1,7})?$/);
const namedFloatSchema = z.union([z.number().finite(), z.literal('NaN'), z.literal('Infinity'), z.literal('-Infinity')]);
/** Arc .NET leaves an initial acronym unchanged rather than lowering its first character. */
export function wireName(name: string): string {
    if (!name) return name;
    return name.length > 1 && name[0]!.toUpperCase() === name[0] && name[1]!.toUpperCase() === name[1]
        ? name : name[0]?.toLowerCase() + name.slice(1);
}

/** Reflect fields decorated with Fundamentals field metadata. */
export function fieldsFor(type: WireType): WireField[] {
    return Fields.getFieldsForType(type as never).map((field: Field) => ({
        name: field.name,
        type: field.type,
        element: field.type === Array ? field.genericArguments[0] : field.enumerable ? field.type : undefined,
        options: readFieldOptions(type, field.name)
    }));
}
/** Construct a Zod input schema from a runtime wire type. */
export function schemaFor(type: WireType, options: FieldOptions = {}, element?: WireType): z.ZodType {
    let schema: z.ZodType;
    if (element || type === Array) {
        if (!element) throw new Error('Array fields require an element type');
        schema = z.array(schemaFor(element));
    } else if (type === String) schema = z.string();
    else if (type === Number) schema = options.namedFloats ? namedFloatSchema : z.number().finite();
    else if (type === Boolean) schema = z.boolean();
    else if (type === Guid) schema = guidSchema;
    else if (type === Date) schema = dateSchema;
    else if (type === DateOnly) schema = dateOnlySchema;
    else if (type === TimeOnly) schema = timeOnlySchema;
    else if (type === TimeSpan) schema = timeSpanSchema;
    else if (type.prototype instanceof ConceptAs) {
        if (!type.valueType) throw new Error(`Concept ${type.name} requires static valueType`);
        schema = schemaFor(type.valueType, { namedFloats: options.namedFloats });
    } else if (DerivedType.getDerivedTypesFor(type as never).length) schema = z.lazy(() => derivedSchema(type));
    else if (fieldsFor(type).length) schema = z.lazy(() => objectSchema(type));
    else throw new Error(`Unsupported Arc wire type: ${type.name}`);
    if (options.values) {
        if (!options.values.length) throw new Error(`Enumeration for ${type.name} requires values`);
        const scalar = type.prototype instanceof ConceptAs ? type.valueType : type;
        const expected = scalar === Number ? 'number' : scalar === Boolean ? 'boolean' : scalar === String ? 'string' : undefined;
        if (!expected || options.values.some(value => typeof value !== expected)) {
            throw new Error(`Enumeration values must match ${type.name}`);
        }
        const literals = options.values.map(value => z.literal(value));
        schema = literals.length === 1 ? literals[0]! : z.union(literals as [
            z.ZodLiteral<string | number | boolean>, z.ZodLiteral<string | number | boolean>,
            ...z.ZodLiteral<string | number | boolean>[]
        ]);
    }
    if (options.nullable) schema = schema.nullable();
    if (Object.hasOwn(options, 'defaultValue')) schema = schema.default(options.defaultValue);
    else if (options.optional) schema = schema.optional();
    return schema;
}
/** Require an unambiguous discriminator and validate every derived shape, including inherited fields. */
function derivedSchema(type: WireType): z.ZodType {
    const variants = DerivedType.getDerivedTypesFor(type as never) as WireType[];
    if (DerivedType.get(type as never)) variants.unshift(type);
    const ids = variants.map(variant => DerivedType.get(variant as never));
    if (ids.some(id => !id || typeof id !== 'string') || new Set(ids).size !== ids.length)
        throw new Error(`Ambiguous Arc derived type: ${type.name}`);
    const shapes = variants.map((variant, index) => objectSchema(variant).extend({ _derivedTypeId: z.literal(ids[index]!) }));
    return z.discriminatedUnion('_derivedTypeId', shapes as unknown as [
        z.ZodObject<z.ZodRawShape>, ...z.ZodObject<z.ZodRawShape>[]
    ]);
}
/** Construct the input schema for a model-bound class. */
export function objectSchema(type: WireType): z.ZodObject<z.ZodRawShape> {
    const shape: Record<string, z.ZodType> = {};
    for (const field of fieldsFor(type)) shape[wireName(field.name)] = schemaFor(field.type, field.options, field.element);
    const id = DerivedType.get(type as never);
    if (id) shape._derivedTypeId = z.literal(id).optional();
    return z.object(shape);
}
/** Materialize validated wire values as concepts, dates, and models. */
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
    if (type === Number && typeof value === 'string') return Number(value);
    if (type === String || type === Number || type === Boolean) return value;
    if (typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid Arc wire model: ${type.name}`);
    const id: unknown = Reflect.get(value, '_derivedTypeId');
    if (id !== undefined) {
        if (id !== DerivedType.get(type as never)) {
            const candidate = (DerivedType.getDerivedTypesFor(type as never) as WireType[])
                .find((derived: WireType) => DerivedType.get(derived as never) === id);
            if (!candidate) throw new Error(`Unknown Arc derived type: ${type.name}`);
            type = candidate;
        }
    } else if (DerivedType.getDerivedTypesFor(type as never).length) throw new Error(`Missing Arc derived type: ${type.name}`);
    const instance = Reflect.construct(type, []) as Record<string, unknown>;
    for (const field of fieldsFor(type)) {
        if (Object.hasOwn(value as object, wireName(field.name))) {
            instance[field.name] = decode(field.type, (value as Record<string, unknown>)[wireName(field.name)], field.element);
        }
    }
    return instance;
}
/** Convert domain values into the JSON wire representation. */
export function encode(value: unknown, declaredType?: WireType, element?: WireType): unknown {
    if (value === null || value === undefined) return value;
    if (value instanceof ConceptAs) return encode((value as ConceptAs<unknown>).value);
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Guid || value instanceof DateOnly || value instanceof TimeOnly || value instanceof TimeSpan) {
        return value.toString();
    }
    if (isQueryPage(value)) return queryPage(value.items.map(item => encode(item, declaredType)), value.totalItems, value.sorting);
    if (isArcTuple(value)) return value.values.map(item => encode(item));
    if (Array.isArray(value)) return value.map(item => encode(item, element));
    if (typeof value === 'object') {
        const fields = fieldsFor(value.constructor as WireType);
        const entries = fields.length ? fields.map(field => [field.name, Reflect.get(value, field.name)] as const) : Object.entries(value);
        const polymorphic = !!declaredType && DerivedType.getDerivedTypesFor(declaredType as never).length > 0;
        const result = Object.fromEntries(entries.filter(([name, item]) => item !== undefined && (item !== null || polymorphic) && name !== '_derivedTypeId')
            .map(([name, item]) => {
                const field = fields.find(candidate => candidate.name === name);
                return [fields.length ? wireName(name) : name, encode(item, field?.type, field?.element)];
            }));
        const id = polymorphic && DerivedType.get(value.constructor as never);
        if (id) result._derivedTypeId = id;
        return result;
    }
    return value;
}
