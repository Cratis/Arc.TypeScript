// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { observe } from '../execution/observability.js';
import type { ArcServer } from '../ArcServer.js';
import type { NativeRequestContext } from './NativeRequestContext.js';
import type { Operation } from './Operation.js';
import type { CommandResult } from '../commands/CommandResult.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { QueryOptions } from '../queries/QueryOptions.js';
import type { QueryResult } from '../queries/QueryResult.js';
import type { ObservableQuerySession } from '../queries/observable/ObservableQuerySession.js';
import { TenantRequestError } from '../tenancy/TenantRequestError.js';
import { resolveTenant } from '../tenancy/resolveTenant.js';
import { commandResult } from '../commands/createCommandResult.js';
import { queryResult } from '../queries/createQueryResult.js';
import { malformed } from './malformed.js';
import { allowedSeverity } from '../validation/allowedSeverity.js';
import { authenticate, verifiedPrincipal } from '../authentication/authenticate.js';
import { correlation } from '../execution/correlation.js';
import { Severity } from '../validation/Severity.js';
import { requestContext } from '../execution/RequestContextStore.js';
import { authorizationRequirements } from '../authorization/authorizationRequirements.js';
import { ObservableSubscriptionLimitError } from '../queries/observable/ObservableSubscriptionLimitError.js';
import { EndpointResponse } from './EndpointResponse.js';
import { handleIntrospection } from './handleIntrospection.js';
import { handleIdentity, handleDiscovery } from './handleIdentity.js';
import { handleOperation } from './handleOperation.js';

/** Bind HTTP handling to the server's execution scopes and observable sessions. */
export interface RequestBindings {
    readonly identitySchema: Record<string, unknown> | undefined;
    hubHttp(request: Request, native?: NativeRequestContext): Promise<Response>;
    runProvider<T>(context: ExecutionContext, callback: () => T | Promise<T>): Promise<T>;
    runScoped(operation: Operation, input: unknown, context: ExecutionContext, options?: QueryOptions): Promise<CommandResult | QueryResult>;
    validateCommand(operation: Operation, input: unknown, context: ExecutionContext): Promise<CommandResult>;
    openSession(name: string, input: unknown, context: ExecutionContext, options: QueryOptions | undefined,
        admission: 'subscription' | 'snapshot'): Promise<ObservableQuerySession>;
    reserveSession(session: ObservableQuerySession, context: ExecutionContext): void;
}

function logError(server: ArcServer, correlationId: string): (error: unknown) => Promise<boolean> {
    let loggingFailed = false;
    return async error => {
        if (loggingFailed) return false;
        try {
            await server.options.logger?.(error, correlationId);
            return true;
        } catch {
            loggingFailed = true;
            return false;
        }
    };
}

interface RoutedRequest {
    server: ArcServer;
    bindings: RequestBindings;
    request: Request;
    native?: NativeRequestContext | (() => NativeRequestContext | Promise<NativeRequestContext>);
    path: string;
    operation?: Operation;
    response: EndpointResponse;
    correlationId: string;
}

async function executeRequest({ server, bindings, request, native, path, operation, response, correlationId }: RoutedRequest): Promise<Response | null> {
    const introspection = !operation;
    if (introspection && request.method !== 'GET') return response.methodNotAllowed('GET');
    if (introspection && path !== '/.cratis/me' && path !== '/.cratis/users' && path !== '/.cratis/tenants')
        return handleIntrospection(server, bindings, path, response);
    const isIdentity = path === '/.cratis/me';
    const isDiscovery = path === '/.cratis/users' || path === '/.cratis/tenants';
    if (!operation && !isIdentity && !isDiscovery) return null;
    const allowed = server.endpoints.get(path)!;
    const methodAllowed = operation?.kind === 'command' ? request.method === 'POST' :
        request.method === 'GET' || (request.method === 'QUERY' && server.options.generatedApis?.enableQueryHttpMethod !== false);
    if (!methodAllowed) return response.methodNotAllowed(allowed);
    if (request.method === 'QUERY' || isIdentity) response.headers.set('cache-control', 'no-store');
    let context: ExecutionContext = { correlationId, principal: undefined, tenantId: undefined, signal: request.signal,
        allowedSeverity: operation?.kind === 'command' ? clientAllowedSeverity(request.headers.get('X-Allowed-Severity')) : Severity.Warning };
    const logFailure = logError(server, correlationId);
    const serverFailure = (): Response => !operation ? response.send({ error: 'An unexpected error occurred' }, 500) :
        response.send(operation.kind === 'command' ? commandResult(context, { exceptionMessages: ['An unexpected error occurred'] }) :
            queryResult(context, { exceptionMessages: ['An unexpected error occurred'] }), 500);
    try {
        const trustedNative = typeof native === 'function' ? await native() : native;
        const declarations = authorizationRequirements(operation?.authorization);
        const schemes = [...new Set(declarations.flatMap(item => item.schemes ?? []))];
        const authentication = server.options.nativePrincipal
            ? { failed: false, principal: trustedNative?.principal === undefined ? undefined : verifiedPrincipal(trustedNative.principal) }
            : await authenticate(request, schemes.length
                ? schemes.map(name => server.options.authenticationSchemes![name]!) : server.options.authentication ?? [],
                schemes.length ? schemes : undefined);
        if (authentication.failed || ((server.options.nativePrincipal || server.options.authentication?.length || schemes.length) &&
            !operation?.authorization?.anonymous &&
            declarations.some(item => item.authenticated || item.roles?.length || item.policy || item.schemes?.length) &&
            !authentication.principal?.isAuthenticated)) {
            if (!operation) return response.send({ error: 'Unauthorized' }, 401);
            const result = operation.kind === 'command' ? commandResult(context, { isAuthorized: false }) :
                queryResult(context, { isAuthorized: false });
            return response.send(result, 401);
        }
        if (isIdentity && !authentication.principal) return response.send({ error: 'Unauthorized' }, 401);
        const tenant = await resolveTenant(server.options, request, authentication.principal, trustedNative);
        context = Object.freeze({ ...context, principal: authentication.principal, tenantId: tenant,
            remoteAddress: trustedNative?.remoteAddress });
        return await requestContext.run(context, async () => {
            try {
                if (isIdentity) return await handleIdentity(server, bindings, context, authentication.principal!, trustedNative, response);
                if (isDiscovery) return await handleDiscovery(server, bindings, path, context, response);
                if (!operation) return null;
                return await handleOperation(server, bindings, operation, request, context, response, logFailure, serverFailure);
            } catch (error) {
                if (error instanceof ObservableSubscriptionLimitError) return response.send(queryResult(context, {
                    exceptionMessages: ['Service temporarily unavailable']
                }), 503, { 'retry-after': '1' });
                await logFailure(error);
                return serverFailure();
            }
        });
    } catch (error) {
        if (error instanceof TenantRequestError) {
            if (!operation) return response.send({ error: error.status === 403 ? 'Forbidden' : 'Invalid tenant request' }, error.status);
            return response.send(operation.kind === 'command'
                ? commandResult(context, error.status === 403 ? { isAuthorized: false } : { validationResults: malformed(context) })
                : queryResult(context, error.status === 403 ? { isAuthorized: false } : { validationResults: malformed(context) }), error.status);
        }
        await logFailure(error);
        return serverFailure();
    }
}

function clientAllowedSeverity(value: string | null): Severity {
    const requested = allowedSeverity(value);
    return requested === Severity.Error ? Severity.Warning : requested;
}

/** Dispatch a request to a registered endpoint without claiming unrelated routes. */
export async function handleRequest(server: ArcServer, bindings: RequestBindings, request: Request,
    native?: NativeRequestContext | (() => NativeRequestContext | Promise<NativeRequestContext>)): Promise<Response | null> {
    const path = new URL(request.url).pathname;
    if (path === '/.cratis/queries/ws') return new Response(null, { status: 426, headers: { upgrade: 'websocket' } });
    if (path === '/.cratis/queries/sse' || path === '/.cratis/queries/sse/subscribe' || path === '/.cratis/queries/sse/unsubscribe')
        return bindings.hubHttp(request, typeof native === 'function' ? await native() : native);
    const operation = server.routes.get(path);
    if (!server.endpoints.has(path)) return null;
    const header = server.options.correlationId?.httpHeader ?? 'X-Correlation-ID';
    const correlationId = correlation(request.headers.get(header));
    const response = new EndpointResponse(new Headers({ [header]: correlationId }));
    return observe('cratis.arc.http.handle', correlationId, { 'http.request.method': request.method,
        'http.route': operation?.route ?? path },
    () => executeRequest({ server, bindings, request, native, path, operation, response, correlationId }),
    undefined, result => result !== null && result.status >= 500);
}
