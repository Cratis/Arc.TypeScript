// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** The first source producing a tenant wins. A header requests a tenant; it does not prove membership. */
export interface TenancyOptions {
    readonly sources: readonly ('header' | 'query' | 'claim' | 'fixed' | 'subdomain')[];
    readonly queryParameter?: string;
    readonly claimType?: string;
    readonly fixed?: string;
    readonly baseDomain?: string;
    readonly required?: boolean;
    /** When set, a selected tenant requires an authenticated principal with an own claim listing that tenant. */
    readonly membershipClaim?: string;
}
