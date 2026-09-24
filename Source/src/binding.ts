// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { PageRequest, QueryOptions, SortRequest } from './contracts.js';

export class BadRequest extends Error {}
function clean(value: unknown, depth = 0): unknown {
    if (depth > 32) throw new BadRequest();
    if (typeof value === 'number' && !Number.isFinite(value)) throw new BadRequest();
    if (Array.isArray(value)) return value.map(item => clean(item, depth + 1));
    if (value && typeof value === 'object') {
        const result: Record<string, unknown> = Object.create(null);
        for (const [key, entry] of Object.entries(value)) {
            if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new BadRequest();
            result[key] = clean(entry, depth + 1);
        }
        return result;
    }
    return value;
}
export async function body(request: Request, limit: number): Promise<unknown> {
    if (Number(request.headers.get('content-length')) > limit) throw new BadRequest();
    if (!request.body) throw new BadRequest();
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > limit) throw new BadRequest();
            chunks.push(value);
        }
    } finally { await reader.cancel(); }
    try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        return clean(JSON.parse(text) as unknown);
    } catch { throw new BadRequest(); }
}
function integer(value: unknown, fallback: number): number {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'number' && (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value))) throw new BadRequest();
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new BadRequest();
    return parsed;
}
function sort(field: unknown, direction: unknown): SortRequest | undefined {
    if (field == null || field === '') return undefined;
    if (typeof field !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field)) throw new BadRequest();
    const normalized = typeof direction === 'string' ? direction.toLowerCase() : direction == null ? 'asc' : '';
    if (!['asc', 'ascending', 'desc', 'descending'].includes(normalized)) throw new BadRequest();
    return { field, direction: normalized.startsWith('desc') ? 'desc' : 'asc' };
}
function asObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequest();
    return value as Record<string, unknown>;
}
function unwrap(schema: z.ZodType): z.ZodType {
    while (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault || schema instanceof z.ZodNullable) schema = schema.unwrap() as z.ZodType;
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
        if (get && Array.isArray(value) && unwrap(declared) instanceof z.ZodArray) {
            const array = unwrap(declared) as z.ZodArray<z.ZodType>;
            result[target] = value.map(entry => coerce(entry as string, array.element as z.ZodType));
        } else if (get && typeof value === 'string') result[target] = coerce(value, declared);
        else result[target] = value;
    }
    return result;
}
export function getQuery(url: URL, schema: z.ZodType): { input: unknown; options: QueryOptions } {
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
    const paging: PageRequest | undefined = pageSize === undefined ? undefined : { page: integer(page, 0), pageSize: integer(pageSize, 0) };
    if (paging && paging.pageSize < 1) throw new BadRequest();
    if (direction !== undefined && field === undefined) throw new BadRequest();
    return { input: bind(schema, args, true), options: { paging, sorting: sort(field, direction) } };
}
export function structuredQuery(value: unknown, schema: z.ZodType): { input: unknown; options: QueryOptions } {
    const envelope = asObject(value);
    if (Object.keys(envelope).some(key => !['arguments', 'paging', 'sorting'].includes(key))) throw new BadRequest();
    const pagingObject = envelope.paging === undefined ? undefined : asObject(envelope.paging);
    const sortingObject = envelope.sorting === undefined ? undefined : asObject(envelope.sorting);
    if (pagingObject && Object.keys(pagingObject).some(key => !['page', 'pageSize'].includes(key))) throw new BadRequest();
    if (sortingObject && Object.keys(sortingObject).some(key => !['field', 'direction'].includes(key))) throw new BadRequest();
    const paging = pagingObject?.pageSize === undefined ? undefined : { page: integer(pagingObject.page, 0), pageSize: integer(pagingObject.pageSize, 0) };
    if (sortingObject?.direction !== undefined && sortingObject.field === undefined) throw new BadRequest();
    return { input: bind(schema, envelope.arguments === undefined ? {} : asObject(envelope.arguments), false), options: { paging, sorting: sort(sortingObject?.field, sortingObject?.direction) } };
}
