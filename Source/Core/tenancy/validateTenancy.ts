// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { TenantResolverType } from './TenantResolverType.js';
import type { TenancyOptions } from './TenancyOptions.js';
import { tenantId } from './tenantId.js';
import { validDomain } from './validDomain.js';
import { sourcesFor } from './sourcesFor.js';

export function validateTenancy(options: TenancyOptions | undefined): void {
    if (!options) return;
    if (options.resolverType !== undefined && options.sources !== undefined) throw new Error('Choose tenant sources or resolverType');
    const sources = sourcesFor(options);
    if (!Array.isArray(sources) || !sources.length || new Set(sources).size !== sources.length ||
        sources.some(source => ![TenantResolverType.Header, TenantResolverType.Query, TenantResolverType.Claim,
            TenantResolverType.Fixed, TenantResolverType.Development, TenantResolverType.Subdomain].includes(source)))
        throw new Error('Invalid tenant sources');
    for (const name of [options.queryParameter, options.claimType, options.membershipClaim])
        if (name !== undefined && !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name)) throw new Error('Invalid tenant option name');
    const fixedTenantId = options.fixedTenantId ?? 'development';
    if ((sources.includes(TenantResolverType.Fixed) || sources.includes(TenantResolverType.Development)) &&
        tenantId(fixedTenantId) !== fixedTenantId)
        throw new Error('Invalid fixed tenant');
    if (sources.includes(TenantResolverType.Subdomain) && (!options.baseDomain || !validDomain(options.baseDomain) ||
        options.baseDomain !== options.baseDomain.toLowerCase()))
        throw new Error('Invalid tenant base domain');
    if (options.required !== undefined && typeof options.required !== 'boolean') throw new Error('Invalid required tenant option');
}
