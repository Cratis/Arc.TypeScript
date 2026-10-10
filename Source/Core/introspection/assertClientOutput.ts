// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClientType } from './ClientType.js';
import type { DtoType } from './DtoType.js';
import { plain } from './manifestGuards.js';


const isSafeNumber = (data: unknown): boolean => typeof data === 'number' && Number.isFinite(data) && Math.abs(data) <= Number.MAX_SAFE_INTEGER;

const primitiveMatchers = new Map<string, (data: unknown) => boolean>([
    ['void', data => data === undefined],
    ['string', data => typeof data === 'string'],
    ['boolean', data => typeof data === 'boolean'],
    ['number', isSafeNumber]
]);

const matchesField = (field: DtoType['fields'][number], data: Record<string, unknown>, depth: number): boolean =>
    field.optional && (!Object.hasOwn(data, field.name) || data[field.name] === undefined) || matchesShape(field.type, data[field.name], depth + 1);

const matchesDto = (shape: DtoType, data: unknown, depth: number): boolean =>
    plain(data) && shape.fields.every(field => matchesField(field, data, depth)) &&
    Object.keys(data).every(key => shape.fields.some(field => field.name === key));

function matchesShape(shape: ClientType, data: unknown, depth: number): boolean {
    if (depth > 8) return false;
    const primitive = primitiveMatchers.get(shape.kind);
    if (primitive) return primitive(data);
    switch (shape.kind) {
        case 'enum': return typeof data === 'string' && shape.values.includes(data);
        case 'array': return Array.isArray(data) && data.every(item => matchesShape(shape.element, item, depth + 1));
        case 'dto': return matchesDto(shape, data, depth);
        default: return false;
    }
}

/** Reject successful envelopes that would lie about a declared client output. Never include values in the error. */
export function assertClientOutput(type: ClientType, value: unknown): unknown {
    // JSON is the HTTP boundary. Snapshot once so later envelope serialization cannot
    // invoke a handler's getters or toJSON a second time with different values.
    const serialized = type.kind === 'void' ? undefined : JSON.stringify(value);
    const wire = type.kind === 'void' ? value : serialized === undefined ? undefined : JSON.parse(serialized) as unknown;
    if (!matchesShape(type, wire, 0)) throw new Error('Declared client output does not match wire shape');
    return wire;
}
