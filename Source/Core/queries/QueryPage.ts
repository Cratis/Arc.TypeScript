// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { SortRequest } from './SortRequest.js';
const pageBrand: unique symbol = Symbol('Arc query page');
export interface QueryPage<T> {
    readonly items: readonly T[];
    readonly totalItems: number;
    /** Provider-confirmed sort applied before skip and limit. */
    readonly sorting?: SortRequest;
    readonly [pageBrand]: true;
}
export function queryPage<T>(items: readonly T[], totalItems: number, sorting?: SortRequest): QueryPage<T> {
    if (!Array.isArray(items) || !Number.isSafeInteger(totalItems) || totalItems < items.length || totalItems < 0)
        throw new Error('Invalid query page');
    return { items, totalItems, ...(sorting ? { sorting } : {}), [pageBrand]: true };
}
export function isQueryPage(value: unknown): value is QueryPage<unknown> {
    return !!value && typeof value === 'object' && Reflect.get(value, pageBrand) === true;
}
