// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import { throwIfCanceled } from '../execution/throwIfCanceled.js';
import type { ReadModelInterceptor } from './ReadModelInterceptor.js';
import { rawReadModelProvenance } from './rawReadModelDocuments.js';

/** Run the interceptors for one returned item: exact-type instances, or raw documents marked as that type. */
export async function interceptReadModel(item: unknown, interceptors: readonly ReadModelInterceptor[],
    context: ExecutionContext): Promise<unknown> {
    throwIfCanceled(context, 'Query canceled');
    if (item === null || typeof item !== 'object') return item;
    const provenance = rawReadModelProvenance(item);
    if (provenance) {
        const handlers = interceptors.filter(handler => handler.model === provenance.model);
        if (!handlers.length) return item;
        if (provenance.tenantId !== context.tenantId)
            throw new Error(`Raw ${provenance.model.name} document belongs to another tenant`);
        for (const handler of handlers) {
            if (!handler.interceptRawDocument)
                throw new Error(`The ${provenance.model.name} read-model interceptor cannot transform raw documents`);
            throwIfCanceled(context, 'Query canceled');
            item = await handler.interceptRawDocument(item as object, provenance);
            throwIfCanceled(context, 'Query canceled');
        }
        // Marks are never cleared: the caller trusts only this call's result, and a stored document emitted again
        // is intercepted again rather than passing as already released.
        return item;
    }
    for (const handler of interceptors) {
        throwIfCanceled(context, 'Query canceled');
        if (item && typeof item === 'object' && item.constructor === handler.model) {
            item = await handler.intercept(item);
            throwIfCanceled(context, 'Query canceled');
        }
    }
    return item;
}

const leaves = [Date, RegExp, ArrayBuffer, Promise, Map, Set, WeakMap, WeakSet];

/**
 * Fail rather than serve an intercepted read model that Arc could not transform.
 *
 * - A raw document marked as an intercepted model, including a typed array or buffer, fails anywhere except in
 *   `intercepted` (the values interception returned for the top-level, array and page slots).
 * - An exact-type instance fails, wherever it appears (slots included), when an interceptor for its type opts in
 *   to protection by implementing `isReleased` and one of those interceptors does not report it released. An
 *   interceptor that returns another protected model's instance therefore cannot bypass that model's check.
 *   Interceptors without `isReleased` keep the pass-through behavior.
 *
 * Only own enumerable values are walked, iteratively; typed arrays, buffers and other leaf types are not descended.
 * Documents copied or mapped into new objects, and values reachable only through `toJSON()`, getters or private
 * fields, are not detected.
 */
export function assertNoUnreleasedReadModels(data: unknown, interceptors: readonly ReadModelInterceptor[],
    intercepted: WeakSet<object> = new WeakSet()): void {
    const models = new Set<unknown>(interceptors.map(handler => handler.model));
    const protecting = new Map<unknown, ReadModelInterceptor[]>();
    for (const handler of interceptors) {
        if (typeof handler.isReleased !== 'function') continue;
        const handlers = protecting.get(handler.model) ?? [];
        handlers.push(handler);
        protecting.set(handler.model, handlers);
    }
    const visited = new WeakSet<object>();
    const pending: object[] = [];
    if (data !== null && typeof data === 'object') pending.push(data);
    while (pending.length) {
        const value = pending.pop()!;
        if (visited.has(value)) continue;
        visited.add(value);
        if (!intercepted.has(value)) {
            const provenance = rawReadModelProvenance(value);
            if (provenance && models.has(provenance.model))
                throw new Error(`Raw ${provenance.model.name} documents must be returned directly, in an array, or in a query page; ` +
                    'nested or projected raw documents are not supported');
        }
        if (ArrayBuffer.isView(value) || leaves.some(type => value instanceof type)) continue;
        const handlers = protecting.get(value.constructor);
        if (handlers && !handlers.every(handler => handler.isReleased!(value) === true))
            throw new Error(`${(value.constructor as { name: string }).name} read models must be returned directly, ` +
                'in an array, or in a query page; instances that were not released are not supported');
        if (Array.isArray(value)) {
            for (let index = 0; index < value.length; index++) {
                const child: unknown = value[index];
                if (child !== null && typeof child === 'object') pending.push(child);
            }
        } else {
            for (const key in value) {
                if (!Object.hasOwn(value, key)) continue;
                const child = (value as Record<string, unknown>)[key];
                if (child !== null && typeof child === 'object') pending.push(child);
            }
        }
    }
}
