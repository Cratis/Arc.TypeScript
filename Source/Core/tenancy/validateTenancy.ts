// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { TenancyOptions } from './TenancyOptions.js';
import { tenantId } from './tenantId.js';
import { validDomain } from './validDomain.js';

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
