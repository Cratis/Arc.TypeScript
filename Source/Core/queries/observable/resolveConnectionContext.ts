// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../../ArcServer.js';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';
import type { NativeRequestContext } from '../../http/NativeRequestContext.js';
import { Severity } from '../../validation/Severity.js';
import { authenticate, verifiedPrincipal } from '../../authentication/authenticate.js';
import { correlation } from '../../execution/correlation.js';
import { resolveTenant } from '../../tenancy/resolveTenant.js';
import type { ResolvedConnectionContext } from './ResolvedConnectionContext.js';

/** Match HTTP authentication, tenancy and correlation for an upgraded or hub connection. */
export async function resolveConnectionContext(server: ArcServer, request: Request, native?: NativeRequestContext):
    Promise<ResolvedConnectionContext> {
    const initial: ExecutionContext = {
        correlationId: correlation(request.headers.get(server.options.correlationId?.httpHeader ?? 'X-Correlation-ID')),
        principal: undefined, tenantId: undefined, remoteAddress: native?.remoteAddress,
        signal: request.signal, allowedSeverity: Severity.Warning
    };
    const authentication = server.options.nativePrincipal
        ? { failed: false, principal: native?.principal === undefined ? undefined : verifiedPrincipal(native.principal) }
        : await authenticate(request, server.options.authentication ?? []);
    if (authentication.failed) return { context: initial, authenticationFailed: true };
    const tenant = await resolveTenant(server.options, request, authentication.principal, native);
    return { context: Object.freeze({ ...initial, principal: authentication.principal, tenantId: tenant }), authenticationFailed: false };
}
