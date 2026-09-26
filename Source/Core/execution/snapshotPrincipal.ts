// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Principal } from '../identity/Principal.js';

/** Preserve host principal fields while detaching roles and claims from their mutable source. */
export function snapshotPrincipal(principal: Principal): Principal {
    const copy: Principal = { ...principal, roles: [...principal.roles],
        ...(principal.claims === undefined ? {} : { claims: structuredClone(principal.claims) }) };
    const seen = new WeakSet<object>();
    const freeze = (value: unknown, depth: number): void => {
        if (!value || typeof value !== 'object' || seen.has(value)) return;
        if (depth > 32) throw new Error('Principal claim graph exceeds maximum depth');
        seen.add(value);
        for (const member of Object.values(value)) freeze(member, depth + 1);
        Object.freeze(value);
    };
    freeze(copy.claims, 0);
    Object.freeze(copy.roles);
    return Object.freeze(copy);
}
