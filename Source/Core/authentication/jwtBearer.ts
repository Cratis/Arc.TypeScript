// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AuthenticationHandler } from './AuthenticationHandler.js';
import { AuthenticationStatus } from './AuthenticationStatus.js';

/** Explicit JWT verifier configuration. Never derive the issuer or keys from an untrusted token. */
export interface JwtBearerOptions {
    readonly jwksUrl: URL;
    readonly issuer: string;
    readonly audience: string | readonly string[];
    readonly algorithms: readonly string[];
    /** Maximum permitted clock drift in seconds; defaults to zero. */
    readonly clockSkewSeconds?: number;
}

/** Verify bearer signatures and registered claims against a pinned issuer, audience and remote JWKS. */
export function jwtBearer(options: JwtBearerOptions): AuthenticationHandler {
    if (options.jwksUrl.protocol !== 'https:' || !options.issuer || !options.audience ||
        !options.algorithms.length || options.algorithms.some(algorithm => !/^(RS|PS|ES|EdDSA)/.test(algorithm)) ||
        options.clockSkewSeconds !== undefined && (!Number.isSafeInteger(options.clockSkewSeconds) || options.clockSkewSeconds < 0))
        throw new Error('Invalid JWT bearer configuration');
    const jwks = createRemoteJWKSet(options.jwksUrl);
    return async request => {
        const header = request.headers.get('authorization');
        if (header === null) return { status: AuthenticationStatus.Anonymous };
        const match = /^Bearer ([^\s]+)$/i.exec(header);
        if (!match) return { status: AuthenticationStatus.Failed };
        try {
            const { payload } = await jwtVerify(match[1]!, jwks, {
                issuer: options.issuer, audience: typeof options.audience === 'string' ? options.audience : [...options.audience], algorithms: [...options.algorithms],
                clockTolerance: options.clockSkewSeconds ?? 0, requiredClaims: ['sub', 'exp', 'iat']
            });
            if (typeof payload.sub !== 'string' || !payload.sub) return { status: AuthenticationStatus.Failed };
            const roles = [payload.roles, payload.role].flatMap(value => typeof value === 'string' ? [value] :
                Array.isArray(value) && value.every(role => typeof role === 'string') ? value as string[] : []);
            return { status: AuthenticationStatus.Authenticated, principal: {
                id: payload.sub, name: typeof payload.name === 'string' ? payload.name : payload.sub,
                isAuthenticated: true, roles, claims: payload
            } };
        } catch { return { status: AuthenticationStatus.Failed }; }
    };
}
