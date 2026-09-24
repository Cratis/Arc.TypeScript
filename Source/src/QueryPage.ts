// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
const pageBrand: unique symbol = Symbol('Arc query page');
export interface QueryPage<T> {
    readonly items: readonly T[];
    readonly totalItems: number;
    readonly [pageBrand]: true;
}
export function queryPage<T>(items: readonly T[], totalItems: number): QueryPage<T> {
    if (!Array.isArray(items) || !Number.isSafeInteger(totalItems) || totalItems < items.length || totalItems < 0)
        throw new Error('Invalid query page');
    return { items, totalItems, [pageBrand]: true };
}
export function isQueryPage(value: unknown): value is QueryPage<unknown> {
    return !!value && typeof value === 'object' && Reflect.get(value, pageBrand) === true;
}
