// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { ClientField } from './ClientField.js';
import type { ClientType } from './ClientType.js';
import { fail, hasChecks, plain } from './manifestGuards.js';
import { isReservedQueryArgument } from './parseClientOperation.js';

const isSafeIntegerCheck = (check: { _zod: { def: unknown } }): boolean => {
    const item = check._zod.def;
    return plain(item) && item.check === 'number_format' && item.format === 'safeint';
};

const isSingleSafeIntegerCheck = (checks: unknown): boolean => Array.isArray(checks) && checks.length === 1 && checks.every(isSafeIntegerCheck);

function zodNumber(definition: object, location: string): ClientType {
    const checks = (definition as { checks?: unknown }).checks;
    if (!isSingleSafeIntegerCheck(checks)) fail(location, 'only finite safe-integer Zod numbers are supported');
    return { kind: 'number' };
}

function zodEnum(schema: z.ZodEnum, location: string): ClientType {
    const values = Object.values(schema.enum);
    if (values.some(value => typeof value !== 'string')) fail(location, 'numeric enum unsupported');
    return { kind: 'enum', values: values as string[] };
}

function zodArray(schema: z.ZodArray, location: string): ClientType {
    const element = zodType(schema.element as z.ZodType, `${location}[]`);
    if (element.kind === 'array' || element.kind === 'void' || element.kind === 'dto') fail(location, 'unsupported input array element');
    return { kind: 'array', element };
}

function rejectUnsupportedDefinition(schema: z.ZodType, location: string): void {
    const definition = schema._zod.def;
    if ('coerce' in definition && definition.coerce === true) fail(location, 'coercion is unsupported');
    if (!(schema instanceof z.ZodNumber) && hasChecks(definition)) fail(location, 'refinements or constraints are unsupported');
}

function zodPrimitive(schema: z.ZodType, location: string): ClientType | undefined {
    if (schema instanceof z.ZodString) return { kind: 'string' };
    if (schema instanceof z.ZodBoolean) return { kind: 'boolean' };
    if (schema instanceof z.ZodNumber) return zodNumber(schema._zod.def, location);
    return undefined;
}

function zodType(schema: z.ZodType, location: string): ClientType {
    rejectUnsupportedDefinition(schema, location);
    const primitive = zodPrimitive(schema, location);
    if (primitive) return primitive;
    if (schema instanceof z.ZodEnum) return zodEnum(schema, location);
    if (schema instanceof z.ZodArray) return zodArray(schema, location);
    return fail(location, `unsupported Zod type ${schema._zod.def.type}; defaults, nullable, transforms and refinements require a separate proven contract`);
}

function inspectField(fieldName: string, original: z.ZodType, id: string): ClientField {
    const at = `${id}.${fieldName}`;
    let field = original;
    if (!(field instanceof z.ZodNumber) && hasChecks(field._zod.def)) fail(at, 'field refinements are unsupported');
    const optional = field instanceof z.ZodOptional;
    if (field instanceof z.ZodOptional) field = field.unwrap() as z.ZodType;
    if (field instanceof z.ZodDefault || original instanceof z.ZodDefault) fail(at, 'Zod defaults may execute user functions during export');
    const type = zodType(field, at);
    if (type.kind === 'void') fail(at, 'void input unsupported');
    return { name: fieldName, type, ...(optional ? { optional: true } : {}) };
}

/** Preflight before ArcServer's legacy JSON Schema conversion, which can evaluate Zod default factories. */
export function inspectClientInput(schema: z.ZodType, id: string): ClientField[] {
    if (!(schema instanceof z.ZodObject)) fail(id, 'input must be a closed Zod object');
    const def = schema._zod.def;
    if (def.catchall && !(def.catchall instanceof z.ZodNever)) fail(id, 'open input object unsupported');
    if (hasChecks(def)) fail(id, 'object refinements are unsupported');
    return Object.entries(schema.shape).map(([fieldName, original]) => inspectField(fieldName, original as z.ZodType, id));
}

/** Reject reserved GET names before schema conversion without invoking application callbacks. */
export function inspectClientQueryInput(schema: z.ZodType, id: string): void {
    if (schema instanceof z.ZodObject && Object.keys(schema.shape).some(key => isReservedQueryArgument(key.toLowerCase())))
        fail(id, 'reserved GET query argument');
}
