// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { TenantResolverType } from './TenantResolverType.js';
import type { TenancyOptions } from './TenancyOptions.js';

/** Choose ordered sources, including the .NET subdomain-to-header fallback. */
export function sourcesFor(options: TenancyOptions): readonly TenantResolverType[] {
    if (options.sources !== undefined) return options.sources;
    return options.resolverType === TenantResolverType.Subdomain ? [TenantResolverType.Subdomain,
        TenantResolverType.Header] : [options.resolverType ?? TenantResolverType.Header];
}
