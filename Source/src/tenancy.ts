// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { isIP } from 'node:net';
import type { Principal } from './Principal.js';
import type { TenancyOptions } from './TenancyOptions.js';
import type { NativeRequestContext } from './NativeRequestContext.js';

const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export class TenantRequestError extends Error {
    constructor(readonly status: 400 | 403) { super('Invalid tenant request'); }
}
export function tenantId(value: string): string {
    const normalized = value.toLowerCase();
    if (!label.test(normalized)) throw new TenantRequestError(400);
    return normalized;
}
export function validateTenancy(options: TenancyOptions | undefined): void {
    if (!options) return;
    if (!Array.isArray(options.sources) || !options.sources.length || new Set(options.sources).size !== options.sources.length ||
        options.sources.some(source => !['header', 'query', 'claim', 'fixed', 'subdomain'].includes(source))) throw new Error('Invalid tenant sources');
    for (const name of [options.queryParameter, options.claimType, options.membershipClaim])
        if (name !== undefined && !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name)) throw new Error('Invalid tenant option name');
    if (options.sources.includes('fixed') && (!options.fixed || tenantId(options.fixed) !== options.fixed)) throw new Error('Invalid fixed tenant');
    if (options.sources.includes('claim') && !options.claimType) throw new Error('Tenant claim type required');
    if (options.sources.includes('subdomain') && (!options.baseDomain || !validDomain(options.baseDomain) || options.baseDomain !== options.baseDomain.toLowerCase()))
        throw new Error('Invalid tenant base domain');
    if (options.required !== undefined && typeof options.required !== 'boolean') throw new Error('Invalid required tenant option');
}
function validDomain(host: string): boolean {
    return host.length <= 253 && isIP(host) === 0 && host.split('.').length >= 2 && host.split('.').every(part => label.test(part));
}
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
                if (label.test(candidate)) selected = candidate;
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
