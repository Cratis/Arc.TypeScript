// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Principal } from '../identity/Principal.js';

/** Detach and freeze strictly plain principal data for borrowed work. */
export function snapshotPrincipal(principal: Principal): Principal {
    const copies = new WeakMap<object, object>();
    const clone = (value: unknown, depth: number): unknown => {
        if (typeof value === 'function' || typeof value === 'symbol') throw new TypeError('Principal contains an unsnapshotable value');
        if (value === null || typeof value !== 'object') return value;
        if (depth > 32) throw new Error('Principal claim graph exceeds maximum depth');
        const prototype = Object.getPrototypeOf(value);
        const array = Array.isArray(value);
        if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
            throw new TypeError('Principal contains an unsnapshotable value');
        const existing = copies.get(value);
        if (existing) return existing;
        const copy: object = array ? new Array((value as unknown[]).length) : Object.create(prototype) as object;
        copies.set(value, copy);
        for (const key of Reflect.ownKeys(value)) {
            // Array length is the sole intrinsic non-enumerable field allowed.
            if (array && key === 'length') continue;
            const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
            if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor))
                throw new TypeError('Principal contains an unsnapshotable property');
            Object.defineProperty(copy, key, { value: clone(descriptor.value, depth + 1),
                enumerable: true, configurable: true, writable: true });
        }
        Object.freeze(copy);
        return copy;
    };
    const copy = clone(principal, 0) as Principal;
    if (typeof copy.id !== 'string' || typeof copy.isAuthenticated !== 'boolean' || !Array.isArray(copy.roles) ||
        !copy.roles.every(role => typeof role === 'string')) throw new TypeError('Invalid principal identity');
    return copy;
}
