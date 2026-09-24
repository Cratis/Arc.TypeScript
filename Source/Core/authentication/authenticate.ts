// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { AuthenticationHandler, Principal } from '../index.js';
import { AuthenticationStatus } from './AuthenticationStatus.js';

export function verifiedPrincipal(principal: Principal): Principal {
    if (!principal || principal.isAuthenticated !== true || typeof principal.id !== 'string' ||
        !Array.isArray(principal.roles) || principal.roles.some(role => typeof role !== 'string')) {
        throw new Error('Authentication handler returned an invalid principal');
    }
    const claims = Object.hasOwn(principal, 'claims') ? principal.claims : undefined;
    // A claim dictionary is a snapshot, not an authority borrowed from the handler.
    // Other extra principal fields remain compatible with pre-claims handlers.
    const copiedClaims = claims !== null && typeof claims === 'object' && !Array.isArray(claims) &&
        (Object.getPrototypeOf(claims) === Object.prototype || Object.getPrototypeOf(claims) === null)
        ? Object.freeze(Object.fromEntries(Object.entries(claims))) : claims;
    return Object.freeze({ ...principal, roles: Object.freeze([...principal.roles]), ...(claims !== undefined ? { claims: copiedClaims } : {}) });
}
export async function authenticate(request: Request, handlers: readonly AuthenticationHandler[],
    schemes?: readonly string[]): Promise<{ principal?: Principal; failed: boolean }> {
    for (const [index, handler] of handlers.entries()) {
        const result = await handler(request);
        if (result.status === AuthenticationStatus.Anonymous) continue;
        if (result.status === AuthenticationStatus.Failed) return { failed: true };
        if (result.status !== AuthenticationStatus.Authenticated) throw new Error('Authentication handler returned an unknown outcome');
        const principal = { ...result.principal };
        delete principal.scheme;
        return { failed: false, principal: verifiedPrincipal({ ...principal,
            ...(schemes ? { scheme: schemes[index] } : {}) }) };
    }
    return { failed: false };
}
