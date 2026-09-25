// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { PageRequest } from '../queries/PageRequest.js';
import type { QueryOptions } from '../queries/QueryOptions.js';
import type { SortRequest } from '../queries/SortRequest.js';
import { BadRequest } from './BadRequest.js';
import { UnreadableQueryBody } from './UnreadableQueryBody.js';
import type { ValidationResult } from '../validation/ValidationResult.js';

export class QueryValidationError extends BadRequest {
    constructor(readonly results: ValidationResult[]) { super(); }
}

const maxInt32 = 2_147_483_647;
function getInteger(value: unknown): number | undefined {
    if (typeof value !== 'string' || !/^[\t\n\v\f\r ]*[+-]?\d+[\t\n\v\f\r ]*$/.test(value)) return undefined;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= -maxInt32 - 1 && parsed <= maxInt32 ? parsed : undefined;
}
function bodyInteger(value: unknown, fallback: number): number {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < -maxInt32 - 1 || value > maxInt32)
        throw new UnreadableQueryBody();
    return value;
}
function pagingRule(message: string, member: string): never {
    throw new QueryValidationError([{ severity: 3, message, members: [member], reason: 'rule' }]);
}
function sort(field: unknown, direction: unknown, member: string): SortRequest | undefined {
    if (field != null && typeof field !== 'string' || direction != null && typeof direction !== 'string')
        throw new UnreadableQueryBody();
    if (field == null || field === '') return undefined;
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field)) throw new BadRequest();
    const normalized = typeof direction === 'string' ? direction.toLowerCase() : direction == null ? 'asc' : '';
    if (!['asc', 'ascending', 'desc', 'descending'].includes(normalized)) {
        throw new QueryValidationError([{ severity: 3, message: 'The sort direction is not a recognized value.',
            members: [member], reason: 'malformedRequest' }]);
    }
    return { field, direction: normalized.startsWith('desc') ? 'desc' : 'asc' };
}
function asObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UnreadableQueryBody();
    return value as Record<string, unknown>;
}
function unwrap(schema: z.ZodType): z.ZodType {
    while (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault || schema instanceof z.ZodNullable)
        schema = schema.unwrap() as z.ZodType;
    return schema;
}
function coerce(value: string, schema: z.ZodType): unknown {
    const declared = unwrap(schema);
    if (declared instanceof z.ZodNumber) {
        if (!/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value) || !Number.isFinite(Number(value))) throw new BadRequest();
        return Number(value);
    }
    if (declared instanceof z.ZodBoolean) {
        if (value !== 'true' && value !== 'false') throw new BadRequest();
        return value === 'true';
    }
    return value;
}
function bind(schema: z.ZodType, values: Record<string, unknown>, get: boolean): Record<string, unknown> {
    const shape = schema instanceof z.ZodObject ? schema.shape : {};
    const result: Record<string, unknown> = Object.create(null);
    const seen = new Set<string>();
    for (const [key, value] of Object.entries(values)) {
        const target = Object.keys(shape).find(name => name.toLowerCase() === key.toLowerCase());
        if (!target || seen.has(target) || value === null && get) throw new BadRequest();
        seen.add(target);
        const declared: z.ZodType = shape[target];
        if (get && value === '' && declared instanceof z.ZodOptional && !unwrap(declared).safeParse('').success) continue;
        if (get && Array.isArray(value) && unwrap(declared) instanceof z.ZodArray) {
            const array = unwrap(declared) as z.ZodArray<z.ZodType>;
            result[target] = value.map(entry => coerce(entry as string, array.element as z.ZodType));
        } else if (get && typeof value === 'string') result[target] = coerce(value, declared);
        else result[target] = value;
    }
    return result;
}
export function getQuery(url: URL, schema: z.ZodType, observable = false): { input: unknown; options: QueryOptions } {
    const args: Record<string, unknown> = Object.create(null);
    const shape = schema instanceof z.ZodObject ? schema.shape : {};
    for (const [key, value] of url.searchParams) {
        const existing = Object.keys(args).find(item => item.toLowerCase() === key.toLowerCase());
        if (existing) {
            const declared = Object.keys(shape).find(name => name.toLowerCase() === key.toLowerCase());
            if (existing !== key || !declared || !(unwrap(shape[declared]) instanceof z.ZodArray)) throw new BadRequest();
            const previous = args[key];
            args[key] = Array.isArray(previous) ? [...previous, value] : [previous, value];
        } else args[key] = value;
    }
    for (const key of Object.keys(args)) {
        const declared = Object.keys(shape).find(name => name.toLowerCase() === key.toLowerCase());
        if (declared && unwrap(shape[declared]) instanceof z.ZodArray && !Array.isArray(args[key])) args[key] = [args[key]];
    }
    const reserved = (name: string): unknown => {
        const key = Object.keys(args).find(item => item.toLowerCase() === name.toLowerCase());
        if (!key) return undefined;
        const value = args[key]; delete args[key]; return value;
    };
    const page = reserved('page'); const pageSize = reserved('pageSize');
    const field = reserved('sortBy'); const direction = reserved('sortDirection');
    if (observable) { reserved('waitForFirstResult'); reserved('waitForFirstResultTimeout'); }
    const parsedSize = getInteger(pageSize);
    const paging: PageRequest | undefined = parsedSize === undefined ? undefined : {
        page: getInteger(page) ?? 0, pageSize: parsedSize
    };
    const errors: ValidationResult[] = [];
    if (paging && paging.page < 0) errors.push({ severity: 3, message: 'Page number must be greater than or equal to 0',
        members: ['Page'], reason: 'rule' });
    if (paging && paging.pageSize <= 0) errors.push({ severity: 3,
        message: 'Page size must be greater than 0', members: ['Size'], reason: 'rule' });
    if (errors.length) throw new QueryValidationError(errors);
    if (direction !== undefined && field === undefined) throw new BadRequest();
    return { input: bind(schema, args, true), options: {
        paging: paging?.pageSize ? paging : undefined, sorting: sort(field, direction, 'sortDirection')
    } };
}
export function structuredQuery(value: unknown, schema: z.ZodType): { input: unknown; options: QueryOptions } {
    const envelope = value == null ? {} : asObject(value);
    const pagingObject = envelope.paging == null ? undefined : asObject(envelope.paging);
    const sortingObject = envelope.sorting == null ? undefined : asObject(envelope.sorting);
    const size = bodyInteger(pagingObject?.pageSize, 0);
    const page = bodyInteger(pagingObject?.page, 0);
    const paging = size > 0 ? { page, pageSize: size } : undefined;
    if (paging && paging.page < 0) pagingRule('Page number must be greater than or equal to 0', 'Page');
    return { input: bind(schema, envelope.arguments == null ? {} : asObject(envelope.arguments), false), options: {
        paging, sorting: sort(sortingObject?.field, sortingObject?.direction, 'sorting.direction')
    } };
}
