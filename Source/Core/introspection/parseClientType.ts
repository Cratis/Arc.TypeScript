// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClientField } from './ClientField.js';
import type { ClientType } from './ClientType.js';
import { name } from './manifestIdentifiers.js';
import { compareOrdinal, fail, hasOnlyKeys, plain } from './manifestGuards.js';

/** Whether the field holds a DTO directly or as an array element. */
export const holdsDto = (field: ClientField): boolean => field.type.kind === 'dto' || field.type.kind === 'array' && field.type.element.kind === 'dto';

// Type descriptors may carry accessor properties, so helpers read value.kind and value.values exactly
// where the original single-function parser did: the number and order of reads is part of the behavior.
const scalarKinds = ['void', 'string', 'boolean', 'number'];

function parseScalar(value: Record<string, unknown>, location: string): ClientType {
    if (Object.keys(value).length !== 1) fail(location, 'unexpected type metadata');
    if (value.kind === 'void') return { kind: 'void' };
    if (value.kind === 'string') return { kind: 'string' };
    if (value.kind === 'boolean') return { kind: 'boolean' };
    return { kind: 'number' };
}

function hasValidEnumValues(value: Record<string, unknown>): boolean {
    if (!Array.isArray(value.values)) return false;
    if ((value.values as unknown[]).length === 0 || (value.values as unknown[]).length > 128) return false;
    if ((value.values as unknown[]).some(item => typeof item !== 'string' || item.length > 1024)) return false;
    return new Set(value.values as unknown[]).size === (value.values as unknown[]).length;
}

function parseEnum(value: Record<string, unknown>, location: string): ClientType {
    if (!hasOnlyKeys(value, ['kind', 'values']) || !hasValidEnumValues(value)) fail(location, 'invalid string enum');
    return { kind: 'enum', values: [...value.values as string[]].sort() };
}

function parseArray(value: Record<string, unknown>, location: string, depth: number): ClientType {
    if (!hasOnlyKeys(value, ['kind', 'element'])) fail(location, 'unexpected array metadata');
    const element = parseType(value.element, `${location}.element`, depth + 1);
    if (element.kind === 'void' || element.kind === 'array') fail(location, 'unsupported array element');
    return { kind: 'array', element };
}

function parseDto(value: Record<string, unknown>, location: string, depth: number): ClientType {
    if (!hasOnlyKeys(value, ['kind', 'name', 'fields'])) fail(location, 'unexpected DTO metadata');
    const typeName = name(value.name, `${location}.name`, true);
    const members = fields(value.fields, `${location}.fields`, depth + 1);
    if (members.some(holdsDto)) fail(location, 'nested DTO is unsupported');
    return { kind: 'dto', name: typeName, fields: members };
}

function parseField(field: unknown, at: string, depth: number): ClientField {
    if (!plain(field) || !hasOnlyKeys(field, ['name', 'type', 'optional'])) fail(at, 'invalid field');
    if (field.optional !== undefined && typeof field.optional !== 'boolean') fail(at, 'optional must be boolean');
    const type = parseType(field.type, `${at}.type`, depth + 1);
    if (type.kind === 'void') fail(at, 'void is not a field');
    return { name: name(field.name, at), type, ...(field.optional === true ? { optional: true } : {}) };
}

/** Parse and validate a list of fields; sorted by name. */
export function fields(value: unknown, location: string, depth: number): ClientField[] {
    if (!Array.isArray(value) || value.length > 128) fail(location, 'expected at most 128 fields');
    const result = value.map((field: unknown, index) => parseField(field, `${location}[${index}]`, depth));
    const names = result.map(field => field.name.toLowerCase());
    if (new Set(names).size !== names.length) fail(location, 'duplicate or case-colliding field');
    return result.sort((a, b) => compareOrdinal(a.name, b.name));
}

/** Parse and validate an explicit wire type. */
export function parseType(value: unknown, location: string, depth = 0): ClientType {
    if (depth > 8) fail(location, 'unsupported or recursive type');
    if (!plain(value) || typeof value.kind !== 'string') fail(location, 'unsupported or recursive type');
    if (scalarKinds.includes(value.kind)) return parseScalar(value, location);
    if (value.kind === 'enum') return parseEnum(value, location);
    if (value.kind === 'array') return parseArray(value, location, depth);
    if (value.kind === 'dto') return parseDto(value, location, depth);
    return fail(location, `unsupported type ${value.kind}`);
}
