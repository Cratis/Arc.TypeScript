// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../../ArcServer.js';
import { BadRequest } from '../../http/BadRequest.js';
import { getQuery } from '../../http/queryBinding.js';
import type { NativeRequestContext } from '../../http/NativeRequestContext.js';
import { correlation } from '../../execution/correlation.js';
import { TenantRequestError } from '../../tenancy/TenantRequestError.js';
import { isObservableOperation } from './ObservableOperation.js';
import { originAllowed } from './originAllowed.js';
import { resolveConnectionContext } from './resolveConnectionContext.js';
import type { ResolvedConnectionContext } from './ResolvedConnectionContext.js';

/** Validate a host-authenticated upgrade before returning an HTTP 101. */
export async function prepareObservableUpgrade(server: ArcServer, request: Request,
    native?: NativeRequestContext): Promise<{ status: number; resolved?: ResolvedConnectionContext }> {
    const path = new URL(request.url).pathname;
    const operation = server.routes.get(path);
    if (!server.endpoints.has(path)) return { status: 404 };
    if (path !== '/.cratis/queries/ws' && (!operation || !isObservableOperation(operation)))
        return { status: 426 };
    const correlationId = correlation(request.headers.get(server.options.correlationId?.httpHeader ?? 'X-Correlation-ID'));
    try {
        if (!await originAllowed(request.headers.get('origin'), request, native, server.options))
            return { status: 403 };
        const resolved = await resolveConnectionContext(server, request, native);
        if (resolved.authenticationFailed) return { status: 401 };
        if (path === '/.cratis/queries/ws' && !server.canAdmitObservableHubConnection(resolved.context))
            return { status: 503 };
        if (operation && isObservableOperation(operation)) getQuery(new URL(request.url), operation.schema, true);
        return { status: 101, resolved };
    } catch (error) {
        if (error instanceof BadRequest) return { status: 400 };
        if (error instanceof TenantRequestError) return { status: error.status };
        try { await server.options.logger?.(error, correlationId); }
        catch { /* The HTTP rejection remains terminal when logging also fails. */ }
        return { status: 500 };
    }
}
