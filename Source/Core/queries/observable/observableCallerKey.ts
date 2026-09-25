// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../../execution/ExecutionContext.js';

/** Keep anonymous and authenticated namespaces distinct, even for an id named "anonymous". */
export function observableCallerKey(context: ExecutionContext): string {
    const tenant = context.tenantId ?? '';
    if (context.principal?.isAuthenticated)
        return JSON.stringify([tenant, 'principal', context.principal.id]);
    if (context.remoteAddress)
        return JSON.stringify([tenant, 'anonymous-address', context.remoteAddress]);
    // Without a peer address, share a conservative tenant-wide budget rather than giving
    // each new anonymous connection a fresh per-caller allowance.
    return JSON.stringify([tenant, 'anonymous-unattributed']);
}
