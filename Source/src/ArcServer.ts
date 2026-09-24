// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import type { CommandResult, ExecutionContext, QueryOptions, QueryResult } from './contracts.js';
import type { ArcServerOptions } from './ArcServerOptions.js';
import { BadRequest, body, getQuery, structuredQuery } from './binding.js';
import { commandOperation, queryOperation } from './pipelines.js';
import type { Operation } from './operation.js';
import { commandResult, malformed, queryResult, status } from './results.js';
import { allowedSeverity, authenticate, correlation } from './security.js';
import { hasFailure, originalFailure } from './failures.js';
import { Severity } from './Severity.js';

const requestContext = new AsyncLocalStorage<ExecutionContext>();
export function currentContext(): ExecutionContext | undefined { return requestContext.getStore(); }
function clientAllowedSeverity(value: string | null): Severity {
    const requested = allowedSeverity(value);
    return requested === Severity.Error ? Severity.Warning : requested;
}
function routeFor(operation: { namespace?: string; name: string; path?: string }, prefix: string, skip: number): string {
    const segments = operation.namespace === undefined ? [] : operation.namespace.split('.');
    for (const segment of [...segments, operation.name]) if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(segment)) throw new Error('Unsafe Arc name');
    if (operation.path) {
        if (!/^\/(?!\/)[a-zA-Z0-9/_-]+\/?$/.test(operation.path) || operation.path.includes('..')) throw new Error('Unsafe Arc path');
        return operation.path.replace(/\/$/, '') || '/';
    }
    const kebab = (value: string): string => value.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();
    return '/' + [prefix, ...segments.slice(skip).map(kebab), kebab(operation.name)].filter(Boolean).join('/');
}
export class ArcServer {
    readonly commands: readonly Operation[];
    readonly queries: readonly Operation[];
    readonly routes: ReadonlyMap<string, Operation>;
    readonly options: ArcServerOptions;

    constructor(options: ArcServerOptions) {
        this.options = options;
        if (options.maxBodyBytes !== undefined && (!Number.isSafeInteger(options.maxBodyBytes) || options.maxBodyBytes <= 0))
            throw new Error('Invalid maximum body size');
        const prefix = options.prefix ?? 'api';
        if (prefix && !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(prefix)) throw new Error('Unsafe Arc prefix');
        const skip = options.segmentsToSkip ?? 0;
        if (!Number.isSafeInteger(skip) || skip < 0) throw new Error('Invalid namespace segments to skip');
        for (const item of [...options.commands ?? [], ...options.queries ?? []]) {
            if (item.authorization?.anonymous && (item.authorization.authenticated || item.authorization.roles?.length))
                throw new Error(`Conflicting Arc authorization: ${item.name}`);
            if (item.schema instanceof z.ZodObject) {
                const folded = Object.keys(item.schema.shape).map(key => key.toLowerCase());
                if (new Set(folded).size !== folded.length) throw new Error(`Ambiguous Arc argument names: ${item.name}`);
            }
        }
        this.commands = (options.commands ?? []).map(item => commandOperation(item, routeFor(item, prefix, skip)));
        this.queries = (options.queries ?? []).map(item => queryOperation(item, routeFor(item, prefix, skip)));
        const routes = new Map<string, Operation>();
        const names = new Set<string>();
        const reserved = new Set(['/.cratis/commands', '/.cratis/queries', '/.cratis/identity-details/schema', '/openapi.json']);
        for (const operation of [...this.commands, ...this.queries]) {
            const name = `${operation.namespace ?? ''}.${operation.name}`.toLowerCase();
            if (names.has(name)) throw new Error(`Duplicate Arc operation: ${name}`);
            names.add(name);
            if (routes.has(operation.route) || reserved.has(operation.route) ||
                (operation.kind === 'command' && (routes.has(operation.route + '/validate') || reserved.has(operation.route + '/validate'))))
                throw new Error(`Duplicate Arc route: ${operation.route}`);
            routes.set(operation.route, operation);
            if (operation.kind === 'command') routes.set(operation.route + '/validate', operation);
        }
        this.routes = routes;
    }

    async executeCommand(name: string, input: unknown, context: ExecutionContext, validateOnly = false): Promise<CommandResult> {
        const operation = this.commands.find(item => [item.namespace, item.name].filter(Boolean).join('.') === name);
        if (!operation) throw new Error(`Unknown command: ${name}`);
        return requestContext.run(Object.freeze({ ...context }), () => operation.run(input, currentContext()!, undefined, validateOnly) as Promise<CommandResult>);
    }
    async performQuery(name: string, input: unknown, context: ExecutionContext, options?: QueryOptions): Promise<QueryResult> {
        const operation = this.queries.find(item => [item.namespace, item.name].filter(Boolean).join('.') === name);
        if (!operation) throw new Error(`Unknown query: ${name}`);
        return requestContext.run(Object.freeze({ ...context, allowedSeverity: Severity.Warning }), () => operation.run(input, currentContext()!, options) as Promise<QueryResult>);
    }

    async handle(request: Request): Promise<Response | null> {
        const path = new URL(request.url).pathname;
        const operation = this.routes.get(path);
        const introspection = ['/.cratis/commands', '/.cratis/queries', '/.cratis/identity-details/schema', '/openapi.json'].includes(path);
        if (!operation && !introspection) return null;
        const header = this.options.correlationHeader ?? 'X-Correlation-ID';
        const correlationId = correlation(request.headers.get(header));
        const headers = new Headers({ [header]: correlationId });
        const send = (value: unknown, code: number): Response => new Response(JSON.stringify(value), { status: code, headers: new Headers({ ...Object.fromEntries(headers), 'content-type': 'application/json; charset=utf-8' }) });
        let loggingFailed = false;
        const logFailure = async (error: unknown): Promise<boolean> => {
            if (loggingFailed) return false;
            try {
                await this.options.logger?.(error, correlationId);
                return true;
            } catch {
                loggingFailed = true;
                return false;
            }
        };
        if (introspection) {
            if (request.method !== 'GET') return new Response(null, { status: 405, headers: new Headers({ ...Object.fromEntries(headers), allow: 'GET' }) });
            if (path === '/.cratis/identity-details/schema') return send(this.options.identityDetailsSchema ?? {}, 200);
            if (path === '/openapi.json') return send(this.openApi(), 200);
            return send((path === '/.cratis/commands' ? this.commands : this.queries).map(item => ({
                name: item.name, namespace: item.namespace ?? '', route: item.route, type: item.name,
                documentationSummary: item.summary ?? '', ...(item.kind === 'command' ? { payloadSchema: item.inputSchema } : {
                    fullyQualifiedName: [item.namespace, item.name].filter(Boolean).join('.'), argumentsSchema: item.inputSchema
                })
            })), 200);
        }
        if (!operation) return null;
        const isValidation = operation.kind === 'command' && path === operation.route + '/validate';
        const allowed = operation.kind === 'command' ? 'POST' : this.options.enableQueryMethod === false ? 'GET' : 'GET, QUERY';
        if (operation.kind === 'command' ? request.method !== 'POST' : request.method !== 'GET' && (request.method !== 'QUERY' || this.options.enableQueryMethod === false))
            return new Response(null, { status: 405, headers: new Headers({ ...Object.fromEntries(headers), allow: allowed }) });
        if (request.method === 'QUERY') headers.set('cache-control', 'no-store');
        let context: ExecutionContext = { correlationId, principal: undefined, tenantId: undefined, signal: request.signal, allowedSeverity: operation.kind === 'command' ? clientAllowedSeverity(request.headers.get('X-Allowed-Severity')) : Severity.Warning };
        const serverFailure = (): Response => send(operation.kind === 'command'
            ? commandResult(context, { exceptionMessages: ['An unexpected error occurred'] })
            : queryResult(context, { exceptionMessages: ['An unexpected error occurred'] }), 500);
        try {
            const authentication = await authenticate(request, this.options.authentication ?? []);
            if (authentication.failed || (this.options.authentication?.length && !operation.authorization?.anonymous &&
                (operation.authorization?.authenticated || operation.authorization?.roles?.length) && !authentication.principal?.isAuthenticated)) {
                const result = operation.kind === 'command' ? commandResult(context, { isAuthorized: false }) : queryResult(context, { isAuthorized: false });
                return send(result, 401);
            }
            const tenantId = this.options.resolveTenant
                ? await this.options.resolveTenant(request, authentication.principal)
                : request.headers.get(this.options.tenantHeader ?? 'x-cratis-tenant-id') ?? undefined;
            context = Object.freeze({ ...context, principal: authentication.principal, tenantId });
            return await requestContext.run(context, async () => {
                try {
                    let input: unknown; let options: QueryOptions | undefined;
                    try {
                        if (operation.kind === 'command') input = await body(request, this.options.maxBodyBytes ?? 1024 * 1024);
                        else if (request.method === 'GET') ({ input, options } = getQuery(new URL(request.url), operation.schema));
                        else ({ input, options } = structuredQuery(await body(request, this.options.maxBodyBytes ?? 1024 * 1024), operation.schema));
                    } catch (error) {
                        if (!(error instanceof BadRequest)) throw error;
                        const failure = operation.kind === 'command' ? commandResult(context, { validationResults: malformed(context) }) : queryResult(context, { validationResults: malformed(context) });
                        return send(failure, 400);
                    }
                    const result = await operation.run(input, context, options, isValidation);
                    if (hasFailure(result) && !await logFailure(originalFailure(result))) return serverFailure();
                    if (result.exceptionMessages.length) {
                        if (!this.options.development) {
                            result.exceptionMessages = ['An unexpected error occurred'];
                            result.exceptionStackTrace = '';
                        }
                    }
                    return send(result, status(result));
                } catch (error) {
                    await logFailure(error);
                    return serverFailure();
                }
            });
        } catch (error) {
            await logFailure(error);
            return serverFailure();
        }
    }
    openApi(): Record<string, unknown> {
        const paths: Record<string, unknown> = {};
        for (const operation of [...this.commands, ...this.queries]) {
            const method = operation.kind === 'command' ? 'post' : 'get';
            paths[operation.route] = { [method]: {
                operationId: [operation.namespace, operation.name].filter(Boolean).join('.'), summary: operation.summary ?? '',
                ...(operation.kind === 'command' ? { requestBody: { required: true, content: { 'application/json': { schema: operation.inputSchema } } } } : {
                    parameters: Object.entries(operation.inputSchema.properties as Record<string, unknown> ?? {}).map(([name, schema]) => ({ name, in: 'query', required: (operation.inputSchema.required as string[] ?? []).includes(name), schema }))
                }), responses: { '200': { description: 'Result' }, '400': { description: 'Invalid request' }, '403': { description: 'Not authorized' }, '500': { description: 'Server error' } }
            } };
        }
        return { openapi: '3.1.0', info: { title: 'Arc', version: '0.1.0' }, paths };
    }
}
