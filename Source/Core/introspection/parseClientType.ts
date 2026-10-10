// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClientField } from './ClientField.js';
import type { ClientType } from './ClientType.js';
import { name } from './manifestIdentifiers.js';
import { compareOrdinal, fail, hasOnlyKeys, plain } from './manifestGuards.js';

/** Whether the field holds a DTO directly or as an array element. */
export const holdsDto = (field: ClientField): boolean => field.type.kind === 'dto' || field.type.kind === 'array' && field.type.element.kind === 'dto';

function parseScalar(value: Record<string, unknown>, location: string): ClientType {
    if (Object.keys(value).length !== 1) fail(location, 'unexpected type metadata');
    return { kind: value.kind as 'void' | 'string' | 'boolean' | 'number' };
}

const isValidEnumValues = (values: unknown): values is string[] =>
    Array.isArray(values) && values.length > 0 && values.length <= 128 &&
    values.every(item => typeof item === 'string' && item.length <= 1024) && new Set(values).size === values.length;

function parseEnum(value: Record<string, unknown>, location: string): ClientType {
    if (!hasOnlyKeys(value, ['kind', 'values']) || !isValidEnumValues(value.values)) fail(location, 'invalid string enum');
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

const typeParsers = new Map<string, (value: Record<string, unknown>, location: string, depth: number) => ClientType>([
    ['void', parseScalar], ['string', parseScalar], ['boolean', parseScalar], ['number', parseScalar],
    ['enum', parseEnum], ['array', parseArray], ['dto', parseDto]
]);

/** Parse and validate an explicit wire type. */
export function parseType(value: unknown, location: string, depth = 0): ClientType {
    if (depth > 8) fail(location, 'unsupported or recursive type');
    if (!plain(value) || typeof value.kind !== 'string') fail(location, 'unsupported or recursive type');
    const parser = typeParsers.get(value.kind);
    if (!parser) return fail(location, `unsupported type ${value.kind}`);
    return parser(value, location, depth);
}
