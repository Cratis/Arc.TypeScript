// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Principal } from '../identity/Principal.js';
import type { TenancyOptions } from './TenancyOptions.js';
import type { NativeRequestContext } from '../http/NativeRequestContext.js';
import { tenantId, tenantLabel } from './tenantId.js';
import { validDomain } from './validDomain.js';
import { TenantRequestError } from './TenantRequestError.js';

function ownClaim(principal: Principal | undefined, name: string): unknown {
    const claims = principal?.isAuthenticated ? principal.claims : undefined;
    return claims !== null && typeof claims === 'object' && !Array.isArray(claims) && Object.hasOwn(claims, name)
        ? (claims as Record<string, unknown>)[name] : undefined;
}
export function resolveConfiguredTenant(request: Request, principal: Principal | undefined, native: NativeRequestContext | undefined, options: TenancyOptions, header: string): string | undefined {
    const url = new URL(request.url);
    let selected: string | undefined;
    for (const source of options.sources) {
        if (source === 'header') selected = request.headers.get(header) ?? undefined;
        if (source === 'query') selected = url.searchParams.get(options.queryParameter ?? 'tenantId') ?? undefined;
        if (source === 'fixed') selected = options.fixed;
        if (source === 'claim') {
            const value = ownClaim(principal, options.claimType!);
            if (value !== undefined && typeof value !== 'string') throw new TenantRequestError(400);
            selected = value;
        }
        if (source === 'subdomain' && native?.authority) {
            const host = native.authority.toLowerCase();
            const suffix = `.${options.baseDomain}`;
            if (validDomain(host) && host.endsWith(suffix)) {
                const candidate = host.slice(0, -suffix.length);
                if (tenantLabel.test(candidate)) selected = candidate;
            }
        }
        if (selected !== undefined && selected !== '') break;
    }
    if (selected !== undefined && selected !== '') selected = tenantId(selected);
    else selected = undefined;
    if (!selected && options.required) throw new TenantRequestError(400);
    if (selected && options.membershipClaim) {
        const memberships = ownClaim(principal, options.membershipClaim);
        if (typeof memberships !== 'string' || !memberships || !memberships.split(',').map(value => value.trim().toLowerCase()).includes(selected)) throw new TenantRequestError(403);
    }
    return selected;
}
