// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcOptions } from '../ArcOptions.js';
import type { Principal } from '../identity/Principal.js';
import type { NativeRequestContext } from '../http/NativeRequestContext.js';
import { resolveConfiguredTenant } from './resolveConfiguredTenant.js';
import { tenantId } from './tenantId.js';

/** Resolve a request tenant consistently for HTTP and observable connections. */
export async function resolveTenant(options: ArcOptions, request: Request, principal: Principal | undefined,
    native?: NativeRequestContext): Promise<string | undefined> {
    if (options.resolveTenant) return options.resolveTenant(request, principal);
    const header = options.tenantHeader ?? 'x-cratis-tenant-id';
    if (!options.tenancy) return request.headers.get(header) ?? undefined;
    const resolved = resolveConfiguredTenant(request, principal, native, options.tenancy, header);
    return resolved === undefined ? undefined : tenantId(resolved);
}
