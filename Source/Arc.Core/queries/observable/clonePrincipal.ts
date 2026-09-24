// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Principal } from '../../identity/Principal.js';

/** Keep one subscription's mutable claim graph out of every other subscription. */
export function clonePrincipal(principal: Principal | undefined): Principal | undefined {
    if (!principal) return undefined;
    const copy = structuredClone(principal);
    const seen = new WeakSet<object>();
    const freeze = (value: unknown, depth: number): void => {
        if (!value || typeof value !== 'object' || seen.has(value)) return;
        if (depth > 32) throw new Error('Principal claim graph exceeds maximum depth');
        seen.add(value);
        for (const member of Object.values(value)) freeze(member, depth + 1);
        Object.freeze(value);
    };
    freeze(copy, 0);
    return copy;
}
