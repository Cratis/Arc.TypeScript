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
 * Fail rather than serve an intercepted raw document that was nested inside another shape, which Arc cannot
 * transform. Documents copied or mapped into new objects no longer carry provenance and are not detected.
 */
export function assertNoUnreleasedRawDocuments(data: unknown, interceptors: readonly ReadModelInterceptor[]): void {
    const models = new Set<unknown>(interceptors.map(handler => handler.model));
    const visited = new WeakSet<object>();
    const pending: unknown[] = [data];
    while (pending.length) {
        const value = pending.pop();
        if (value === null || typeof value !== 'object' || visited.has(value)) continue;
        visited.add(value);
        if (ArrayBuffer.isView(value) || leaves.some(type => value instanceof type)) continue;
        const provenance = rawReadModelProvenance(value);
        if (provenance && models.has(provenance.model))
            throw new Error(`Raw ${provenance.model.name} documents must be returned directly, in an array, or in a query page; ` +
                'nested or projected raw documents are not supported');
        pending.push(...Object.values(value));
    }
}
