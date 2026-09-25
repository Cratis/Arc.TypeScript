// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { TenantResolverType } from './TenantResolverType.js';
import type { Principal } from '../identity/Principal.js';

/** A header requests a tenant; it does not prove membership. Ordered sources are a TypeScript extension. */
export interface TenancyOptions {
    /** Select one built-in source, as in .NET; defaults to header when sources is omitted. */
    readonly resolverType?: TenantResolverType;
    /** Ordered tenant sources; first matching source wins. Do not combine with resolverType. */
    readonly sources?: readonly TenantResolverType[];
    /** Tenant header and subdomain fallback; defaults to x-cratis-tenant-id. */
    readonly httpHeader?: string;
    /** Trusted application resolver; its answer is final and is not normalized by Arc. */
    readonly resolve?: (request: Request, principal: Principal | undefined) => string | undefined | Promise<string | undefined>;
    /** Parameter used by the query source; defaults to tenantId. */
    readonly queryParameter?: string;
    /** Claim used by the claim source; defaults to tenant_id. */
    readonly claimType?: string;
    /** Tenant returned by fixed and development sources; defaults to development when selected. */
    readonly fixedTenantId?: string;
    /** Registrable base domain used for subdomain selection. */
    readonly baseDomain?: string;
    /** Require a selected tenant for every request. */
    readonly required?: boolean;
    /** Own claim listing tenants of which the authenticated principal is a member. */
    readonly membershipClaim?: string;
}
