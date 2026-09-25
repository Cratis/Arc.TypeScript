// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { AuthenticationHandler } from './AuthenticationHandler.js';
import { AuthenticationStatus } from './AuthenticationStatus.js';

/** .NET ClaimTypes equivalents used by the forwarded EasyAuth principal. */
export const microsoftIdentityClaims = Object.freeze({
    name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    nameIdentifier: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
    role: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
    provider: 'urn:cratis:arc:identity:provider'
});
const principalSchema = z.object({
    identityProvider: z.string().default(''), userId: z.string().default(''), userDetails: z.string().default(''),
    userRoles: z.array(z.string()).default([]), claims: z.array(z.object({ typ: z.string(), val: z.string() })).default([])
});
// .NET removes NameIdentifier and sub exactly; only the provider type is case-insensitive.
const asciiLower = (value: string): string => value.replace(/[A-Z]/g, char => char.toLowerCase());
const reserved = (type: string): boolean => type === microsoftIdentityClaims.nameIdentifier || type === 'sub' ||
    asciiLower(type) === microsoftIdentityClaims.provider;

/**
 * Decode EasyAuth headers ONLY behind an ingress that removes caller-supplied x-ms-client-principal* headers.
 * Base64 is not authentication. Registration is an explicit trust decision; no header is read by default.
 */
export function microsoftIdentityPlatform(): AuthenticationHandler {
    return request => {
        const id = request.headers.get('x-ms-client-principal-id');
        const name = request.headers.get('x-ms-client-principal-name');
        const encoded = request.headers.get('x-ms-client-principal');
        if (id === null || name === null || encoded === null) return { status: AuthenticationStatus.Anonymous };
        try {
            if (!id || !encoded || encoded.length > 64 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Invalid principal');
            const decoded = atob(encoded);
            if (btoa(decoded) !== encoded) throw new Error('Invalid principal');
            const bytes = Uint8Array.from(decoded, character => character.charCodeAt(0));
            const payload: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
            const client = principalSchema.parse(payload);
            const claims: Record<string, string> = Object.create(null) as Record<string, string>;
            const roles = [...client.userRoles];
            for (const claim of client.claims) if (!reserved(claim.typ)) {
                claims[claim.typ] = claim.val;
                if (claim.typ === microsoftIdentityClaims.role) roles.push(claim.val);
            }
            claims[microsoftIdentityClaims.name] = client.userDetails;
            claims[microsoftIdentityClaims.nameIdentifier] = id;
            claims.sub = id;
            if (client.identityProvider.trim()) claims[microsoftIdentityClaims.provider] = client.identityProvider;
            // .NET accepts both userRoles and role claims in the serialized claim list.
            return { status: AuthenticationStatus.Authenticated, principal: {
                id, name: client.userDetails, roles, isAuthenticated: true, claims
            } };
        } catch { return { status: AuthenticationStatus.Failed }; }
    };
}
