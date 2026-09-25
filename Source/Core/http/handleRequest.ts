// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { observe } from '../observability.js';
import { stringifyWire } from '../reflection/stringifyWire.js';
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
import { BadRequest } from './BadRequest.js';
import { body } from './body.js';
import { utf8Bytes } from './utf8Bytes.js';
import { getQuery, structuredQuery } from './queryBinding.js';
import { commandResult, malformed, queryResult, status } from '../results/index.js';
import { allowedSeverity } from '../validation/allowedSeverity.js';
import { authenticate, verifiedPrincipal } from '../authentication/authenticate.js';
import { correlation } from '../execution/correlation.js';
import { hasFailure, originalFailure } from '../results/failureTracking.js';
import { Severity } from '../validation/Severity.js';
import { requestContext } from '../execution/RequestContextStore.js';
import { isObservableOperation } from '../queries/observable/ObservableOperation.js';
import { authorizationRequirements } from '../authorization/authorizationRequirements.js';

function clientAllowedSeverity(value: string | null): Severity {
    const requested = allowedSeverity(value);
    return requested === Severity.Error ? Severity.Warning : requested;
}
import { snapshot, snapshotOptions } from '../queries/observable/snapshot.js';
import { directSse } from '../queries/observable/directSse.js';
import { ObservableSubscriptionLimitError } from '../queries/observable/ObservableSubscriptionLimitError.js';

export interface RequestBindings {
    readonly identitySchema: Record<string, unknown> | undefined;
    hubHttp(request: Request, native?: NativeRequestContext): Promise<Response>;
    runProvider<T>(context: ExecutionContext, callback: () => T | Promise<T>): Promise<T>;
    runScoped(operation: Operation, input: unknown, context: ExecutionContext, options?: QueryOptions, validateOnly?: boolean): Promise<CommandResult | QueryResult>;
    openSession(name: string, input: unknown, context: ExecutionContext, options: QueryOptions | undefined, admission: 'subscription' | 'snapshot'): Promise<ObservableQuerySession>;
    reserveSession(session: ObservableQuerySession, context: ExecutionContext): void;
}

export async function handleRequest(server: ArcServer, bindings: RequestBindings, request: Request,
    native?: NativeRequestContext | (() => NativeRequestContext | Promise<NativeRequestContext>)): Promise<Response | null> {
        const path = new URL(request.url).pathname;
        if (path === '/.cratis/queries/ws') return new Response(null, { status: 426, headers: { upgrade: 'websocket' } });
        if (path === '/.cratis/queries/sse' || path === '/.cratis/queries/sse/subscribe' ||
            path === '/.cratis/queries/sse/unsubscribe')
            return bindings.hubHttp(request, typeof native === 'function' ? await native() : native);
        const operation = server.routes.get(path);
        if (!server.endpoints.has(path)) return null;
        const introspection = !operation;
        const header = server.options.correlationHeader ?? 'X-Correlation-ID';
        const correlationId = correlation(request.headers.get(header));
        const headers = new Headers({ [header]: correlationId });
        const send = (value: unknown, code: number, extra?: HeadersInit): Response => new Response(stringifyWire(value), { status: code, headers: new Headers({ ...Object.fromEntries(headers), 'content-type': 'application/json; charset=utf-8', ...Object.fromEntries(new Headers(extra)) }) });
        let loggingFailed = false;
        const logFailure = async (error: unknown): Promise<boolean> => {
            if (loggingFailed) return false;
            try {
                await server.options.logger?.(error, correlationId);
                return true;
            } catch {
                loggingFailed = true;
                return false;
            }
        };
        return observe('cratis.arc.http.handle', correlationId, { 'http.request.method': request.method,
            'http.route': operation?.route ?? path }, async () => {
        if (introspection && request.method !== 'GET') return new Response(null, { status: 405, headers: new Headers({ ...Object.fromEntries(headers), allow: 'GET' }) });
        if (introspection && path !== '/.cratis/me' && path !== '/.cratis/users' && path !== '/.cratis/tenants') {
            if (path === '/.cratis/identity-details/schema') return send(bindings.identitySchema ?? server.options.identityDetailsSchema ?? {}, 200);
            if (path === '/openapi.json') return send(server.openApi(), 200);
            return send((path === '/.cratis/commands' ? server.commands : server.queries).map(item => ({
                name: item.name, namespace: item.namespace ?? '', route: item.route, type: item.name,
                documentationSummary: item.summary ?? '', ...(item.kind === 'command' ? { payloadSchema: item.inputSchema } : {
                    fullyQualifiedName: item.fullyQualifiedName, argumentsSchema: item.inputSchema
                })
            })), 200);
        }
        const isIdentity = path === '/.cratis/me';
        const isDiscovery = path === '/.cratis/users' || path === '/.cratis/tenants';
        if (!operation && !isIdentity && !isDiscovery) return null;
        const isValidation = operation?.kind === 'command' && path === operation.route + '/validate';
        const allowed = server.endpoints.get(path)!;
        if (operation?.kind === 'command' ? request.method !== 'POST' : request.method !== 'GET' && (request.method !== 'QUERY' || server.options.enableQueryMethod === false))
            return new Response(null, { status: 405, headers: new Headers({ ...Object.fromEntries(headers), allow: allowed }) });
        if (request.method === 'QUERY' || isIdentity) headers.set('cache-control', 'no-store');
        let context: ExecutionContext = { correlationId, principal: undefined, tenantId: undefined, signal: request.signal, allowedSeverity: operation?.kind === 'command' ? clientAllowedSeverity(request.headers.get('X-Allowed-Severity')) : Severity.Warning };
        const serverFailure = (): Response => !operation ? send({ error: 'An unexpected error occurred' }, 500) : send(operation.kind === 'command'
            ? commandResult(context, { exceptionMessages: ['An unexpected error occurred'] })
            : queryResult(context, { exceptionMessages: ['An unexpected error occurred'] }), 500);
        try {
            const trustedNative = typeof native === 'function' ? await native() : native;
            const declarations = authorizationRequirements(operation?.authorization);
            const schemes = [...new Set(declarations.flatMap(item => item.schemes ?? []))];
            const authentication = server.options.nativePrincipal
                ? { failed: false, principal: trustedNative?.principal === undefined ? undefined : verifiedPrincipal(trustedNative.principal) }
                : await authenticate(request, schemes.length
                    ? schemes.map(name => server.options.authenticationSchemes![name]!) : server.options.authentication ?? [],
                    schemes.length ? schemes : undefined);
            if (authentication.failed || ((server.options.nativePrincipal || server.options.authentication?.length || schemes.length) && !operation?.authorization?.anonymous &&
                declarations.some(item => item.authenticated || item.roles?.length || item.policy || item.schemes?.length) &&
                !authentication.principal?.isAuthenticated)) {
                if (!operation) return send({ error: 'Unauthorized' }, 401);
                const result = operation.kind === 'command' ? commandResult(context, { isAuthorized: false }) : queryResult(context, { isAuthorized: false });
                return send(result, 401);
            }
            if (isIdentity && !authentication.principal) return send({ error: 'Unauthorized' }, 401);
            const tenant = await resolveTenant(server.options, request, authentication.principal, trustedNative);
            context = Object.freeze({ ...context, principal: authentication.principal,
                tenantId: tenant, remoteAddress: trustedNative?.remoteAddress });
            return await requestContext.run(context, async () => {
                try {
                    if (isIdentity) {
                        const json = await observe('cratis.arc.identity.resolve', correlationId, {}, () => bindings.runProvider(context, async () => {
                            const details = await server.options.identityDetails!.provide(authentication.principal!, context);
                            if (details === undefined) return undefined;
                            const parsed = server.options.identityDetails!.schema!.parse(details);
                            const identity = { id: authentication.principal!.id, name: authentication.principal!.name ?? '', isAuthenticated: true, isAuthorized: true, roles: authentication.principal!.roles, details: parsed };
                            const serialized = JSON.stringify(identity);
                            // atob() in the existing client decodes bytes as Latin-1, not UTF-8.
                            const cookieJson = serialized.replace(/[\u007f-\uffff]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
                            const cookie = `.cratis-identity=${btoa(cookieJson)}; Path=/; SameSite=Lax${trustedNative?.secure === true ? '; Secure' : ''}`;
                            if (utf8Bytes(cookie) > 4096) throw new Error('Identity details too large');
                            return { serialized, cookie };
                        }));
                        if (json === undefined) return send({ error: 'Forbidden' }, 403);
                        return new Response(json.serialized, { status: 200, headers: new Headers({ ...Object.fromEntries(headers), 'content-type': 'application/json; charset=utf-8', 'set-cookie': json.cookie }) });
                    }
                    if (isDiscovery) {
                        const provider = path === '/.cratis/users' ? server.options.developmentUsers : server.options.developmentTenants;
                        if (!provider) return send([], 200);
                        const json = await bindings.runProvider(context, async () => {
                            const providers = Array.isArray(provider) ? provider : [provider];
                            const values: unknown = (await Promise.all(providers.map(provide => provide(context)))).flat();
                            const schema = path === '/.cratis/users'
                                ? z.array(z.object({ microsoftIdentity: z.object({ identityProvider: z.string().max(256), userId: z.string().max(256), userDetails: z.string().max(256), userRoles: z.array(z.string().max(256)).max(64), claims: z.array(z.object({ typ: z.string().max(256), val: z.string().max(256) })).max(64) }), details: z.unknown().optional() })).max(100)
                                : z.array(z.object({ id: z.string().max(256), name: z.string().max(256) })).max(100);
                            const serialized = JSON.stringify(schema.parse(values));
                            if (utf8Bytes(serialized) > 32 * 1024) throw new Error('Discovery output too large');
                            return serialized;
                        });
                        return new Response(json, { status: 200, headers: new Headers({ ...Object.fromEntries(headers), 'content-type': 'application/json; charset=utf-8' }) });
                    }
                    if (!operation) return null;
                    let input: unknown; let options: QueryOptions | undefined;
                    let snapshotRequest = { wait: false, timeoutMs: 30_000 };
                    try {
                        if (request.method === 'GET' && isObservableOperation(operation))
                            snapshotRequest = snapshotOptions(new URL(request.url));
                        if (operation.kind === 'command') input = await body(request, server.options.maxBodyBytes ?? 1024 * 1024);
                        else if (request.method === 'GET') ({ input, options } = getQuery(new URL(request.url), operation.schema, isObservableOperation(operation)));
                        else ({ input, options } = structuredQuery(await body(request, server.options.maxBodyBytes ?? 1024 * 1024), operation.schema));
                    } catch (error) {
                        if (!(error instanceof BadRequest)) throw error;
                        const failure = operation.kind === 'command' ? commandResult(context, { validationResults: malformed(context) }) : queryResult(context, { validationResults: malformed(context) });
                        return send(failure, 400);
                    }
                    if (isObservableOperation(operation)) {
                        const name = operation.fullyQualifiedName;
                        const streaming = request.method === 'GET' &&
                            request.headers.get('accept')?.toLowerCase().includes('text/event-stream') === true;
                        const session = await bindings.openSession(name, input, context, options,
                            streaming ? 'subscription' : 'snapshot');
                        if (streaming) {
                            if (session.rejection) {
                                const rejected = session.rejection;
                                if (rejected.hasExceptions && !server.options.development) {
                                    rejected.exceptionMessages = ['An unexpected error occurred'];
                                    rejected.exceptionStackTrace = '';
                                }
                                return send(rejected, status(rejected));
                            }
                            return directSse(session, headers);
                        }
                        try {
                            const outcome = await snapshot(session, context, snapshotRequest.wait, snapshotRequest.timeoutMs,
                                () => bindings.reserveSession(session, context));
                            if (!outcome.protocol && outcome.result.hasExceptions && !server.options.development) {
                                outcome.result.exceptionMessages = ['An unexpected error occurred'];
                                outcome.result.exceptionStackTrace = '';
                            }
                            return send(outcome.result, outcome.code);
                        } finally { await session.close(); }
                    }
                    const result = await bindings.runScoped(operation, input, context, options, isValidation);
                    if (hasFailure(result) && !await logFailure(originalFailure(result))) return serverFailure();
                    if (result.exceptionMessages.length) {
                        if (!server.options.development) {
                            result.exceptionMessages = ['An unexpected error occurred'];
                            result.exceptionStackTrace = '';
                        }
                    }
                    return send(result, status(result));
                } catch (error) {
                    if (error instanceof ObservableSubscriptionLimitError) return send(queryResult(context, {
                        exceptionMessages: ['Service temporarily unavailable']
                    }), 503, { 'retry-after': '1' });
                    await logFailure(error);
                    return serverFailure();
                }
            });
        } catch (error) {
            if (error instanceof TenantRequestError) {
                if (!operation) return send({ error: error.status === 403 ? 'Forbidden' : 'Invalid tenant request' }, error.status);
                return send(operation.kind === 'command'
                    ? commandResult(context, error.status === 403 ? { isAuthorized: false } : { validationResults: malformed(context) })
                    : queryResult(context, error.status === 403 ? { isAuthorized: false } : { validationResults: malformed(context) }), error.status);
            }
            await logFailure(error);
            return serverFailure();
        }
        }, undefined, response => response !== null && response.status >= 500);
    }
