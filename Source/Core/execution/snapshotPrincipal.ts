// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Principal } from '../identity/Principal.js';

/** Detach and freeze the principal's roles, claims, and extra fields for borrowed work. */
export function snapshotPrincipal(principal: Principal): Principal {
    const prototype = Object.getPrototypeOf(principal);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Principal cannot be snapshotted');
    const { id, isAuthenticated, roles, name, scheme, claims } = principal;
    if (typeof id !== 'string' || typeof isAuthenticated !== 'boolean' || !Array.isArray(roles) ||
        !roles.every(role => typeof role === 'string')) throw new TypeError('Invalid principal identity');
    // Explicit fields also capture non-enumerable getters on plain principals.
    const source = { ...principal, id, isAuthenticated, roles,
        ...(name === undefined ? {} : { name }), ...(scheme === undefined ? {} : { scheme }),
        ...(claims === undefined ? {} : { claims }) };
    const seen = new WeakSet<object>();
    const verify = (value: unknown, depth: number): void => {
        if (!value || typeof value !== 'object' || seen.has(value)) return;
        if (depth > 32) throw new Error('Principal claim graph exceeds maximum depth');
        const memberPrototype = Object.getPrototypeOf(value);
        if (memberPrototype !== Object.prototype && memberPrototype !== null && memberPrototype !== Array.prototype &&
            memberPrototype !== Map.prototype && memberPrototype !== Set.prototype && memberPrototype !== Date.prototype)
            throw new TypeError('Principal contains an unsnapshotable value');
        seen.add(value);
        if (value instanceof Map) for (const [key, member] of value) {
            verify(key, depth + 1);
            verify(member, depth + 1);
        }
        if (value instanceof Set) for (const member of value) verify(member, depth + 1);
        for (const member of Object.values(value)) verify(member, depth + 1);
    };
    verify(source, -1); // Claims start at depth 0, as before principal-level freezing.
    const copy: Principal = structuredClone(source);
    if (copy.id !== id || copy.isAuthenticated !== isAuthenticated || !Array.isArray(copy.roles) ||
        copy.roles.length !== roles.length || copy.roles.some((role, index) => role !== roles[index]))
        throw new TypeError('Principal snapshot lost identity');
    const frozen = new WeakSet<object>();
    const freeze = (value: unknown, depth: number): void => {
        if (!value || typeof value !== 'object' || frozen.has(value)) return;
        if (depth > 32) throw new Error('Principal claim graph exceeds maximum depth');
        frozen.add(value);
        for (const member of Object.values(value)) freeze(member, depth + 1);
        Object.freeze(value);
    };
    freeze(copy, -1);
    return copy;
}
