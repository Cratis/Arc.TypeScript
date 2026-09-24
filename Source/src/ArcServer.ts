// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { CommandResult, ExecutionContext, QueryOptions, QueryResult } from './contracts.js';
import type { ArcServerOptions } from './ArcServerOptions.js';
import type { NativeRequestContext } from './NativeRequestContext.js';
import { TenantRequestError, resolveConfiguredTenant, tenantId, validateTenancy } from './tenancy.js';
import { BadRequest, body, getQuery, structuredQuery } from './binding.js';
import { commandOperation, queryOperation } from './pipelines.js';
import type { Operation } from './operation.js';
import { commandResult, malformed, queryResult, status } from './results.js';
import { allowedSeverity, authenticate, correlation, verifiedPrincipal } from './security.js';
import { hasFailure, originalFailure, recordFailure } from './failures.js';
import { Severity } from './Severity.js';
import { ServiceRegistry } from './ServiceRegistry.js';
import { withServices } from './ServiceScope.js';
import { requestContext } from './RequestContextStore.js';
import { inspectClientInput, inspectClientQueryInput } from './ClientManifest.js';
import { observableOperation, isObservableOperation } from './queries/observable/ObservableOperation.js';
import { ObservableQuerySession } from './queries/observable/ObservableQuerySession.js';
import { snapshot, snapshotOptions } from './queries/observable/snapshot.js';
import { directSse } from './queries/observable/directSse.js';
import { closeNodeWebSockets } from './queries/observable/attachNodeWebSockets.js';
import { ObservableSubscriptionLimitError } from './queries/observable/ObservableSubscriptionLimitError.js';
import { ObservableLimits } from './queries/observable/ObservableLimits.js';
import { observableCallerKey } from './queries/observable/observableCallerKey.js';
import { ObservableQueryHub } from './queries/observable/ObservableQueryHub.js';
import type { ObservableSocket } from './queries/observable/ObservableSocket.js';
import type { ResolvedConnectionContext } from './queries/observable/ResolvedConnectionContext.js';
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
    /** All root-owned endpoints and their allowed methods. Adapters use this for raw path dispatch. */
    readonly endpoints: ReadonlyMap<string, string>;
    readonly options: ArcServerOptions;
    readonly services: ServiceRegistry;
    readonly observableLimits: ObservableLimits;
    readonly #ownsServices: boolean;
    readonly #identitySchema: Record<string, unknown> | undefined;
    readonly #observableSessions = new Set<ObservableQuerySession>();
    readonly #snapshotSessions = new Set<ObservableQuerySession>();
    readonly #retiringSessions = new Set<ObservableQuerySession>();
    readonly #observableOwners = new Map<ObservableQuerySession, string>();
    readonly #hub: ObservableQueryHub;
    readonly #openingOwners = new Map<string, number>();
    readonly #observableCleanupFailures: unknown[] = [];
    #openingObservableSessions = 0;
    #openingSnapshots = 0;
    #disposed = false;

    constructor(options: ArcServerOptions) {
        this.options = options;
        validateTenancy(options.tenancy);
        if (options.nativePrincipal && options.authentication?.length) throw new Error('Native principal and Arc authentication handlers cannot be combined');
        if (options.identityDetails && (!(options.identityDetails.schema instanceof z.ZodType) || typeof options.identityDetails.provide !== 'function' || options.identityDetailsSchema))
            throw new Error('Identity details require a provider schema; legacy schema cannot be combined');
        if ((options.developmentUsers || options.developmentTenants) && !options.development) throw new Error('Discovery providers require development mode');
        this.#identitySchema = options.identityDetails ? z.toJSONSchema(options.identityDetails.schema) : undefined;
        this.observableLimits = new ObservableLimits(options);
        if (options.allowedOrigins !== undefined && !Array.isArray(options.allowedOrigins) &&
            typeof options.allowedOrigins !== 'function') throw new Error('Invalid allowed Origins');
        if (Array.isArray(options.allowedOrigins) && options.allowedOrigins.some(origin => {
            if (typeof origin !== 'string') return true;
            try {
                const parsed = new URL(origin);
                return parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol);
            } catch { return true; }
        })) throw new Error('Invalid allowed Origin');
        this.#ownsServices = !(options.services instanceof ServiceRegistry);
        this.services = options.services instanceof ServiceRegistry ? options.services : new ServiceRegistry(options.services);
        if (options.maxBodyBytes !== undefined && (!Number.isSafeInteger(options.maxBodyBytes) || options.maxBodyBytes <= 0))
            throw new Error('Invalid maximum body size');
        if (options.observableKeepAliveIntervalMs !== undefined &&
            (!Number.isSafeInteger(options.observableKeepAliveIntervalMs) || options.observableKeepAliveIntervalMs < 0 ||
                options.observableKeepAliveIntervalMs > 120_000)) throw new Error('Invalid observable keep-alive interval');
        if (options.enableObservableHealth !== undefined && typeof options.enableObservableHealth !== 'boolean')
            throw new Error('Invalid observable health option');
        const prefix = options.prefix ?? 'api';
        if (prefix && !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(prefix)) throw new Error('Unsafe Arc prefix');
        const skip = options.segmentsToSkip ?? 0;
        if (!Number.isSafeInteger(skip) || skip < 0) throw new Error('Invalid namespace segments to skip');
        for (const item of [...options.commands ?? [], ...options.queries ?? [], ...options.observableQueries ?? []]) {
            if (item.clientOutput) {
                const id = [item.namespace, item.name].filter(Boolean).join('.');
                if (options.queries?.some(query => query === item) || options.observableQueries?.some(query => query === item))
                    inspectClientQueryInput(item.schema, id);
                inspectClientInput(item.schema, id);
            }
            if (item.authorization?.anonymous && (item.authorization.authenticated || item.authorization.roles?.length))
                throw new Error(`Conflicting Arc authorization: ${item.name}`);
            if (item.schema instanceof z.ZodObject) {
                const folded = Object.keys(item.schema.shape).map(key => key.toLowerCase());
                if (new Set(folded).size !== folded.length) throw new Error(`Ambiguous Arc argument names: ${item.name}`);
            }
        }
        this.commands = (options.commands ?? []).map(item => commandOperation(item, routeFor(item, prefix, skip)));
        this.queries = [
            ...(options.queries ?? []).map(item => queryOperation(item, routeFor(item, prefix, skip))),
            ...(options.observableQueries ?? []).map(item => observableOperation(item, routeFor(item, prefix, skip))),
            ...(options.enableObservableHealth ? [{ ...observableOperation({
                name: 'ObserveHealth', namespace: 'QueryHealth', path: '/.cratis/queries/health',
                schema: z.object({}), authorization: { authenticated: true },
                observe: (_input, context) => this.#hub.observeHealth(context)
            }, '/.cratis/queries/health'), internal: true }] : [])
        ];
        const routes = new Map<string, Operation>();
        const names = new Set<string>();
        const endpoints = new Map<string, string>([
            ['/.cratis/commands', 'GET'], ['/.cratis/queries', 'GET'],
            ['/.cratis/identity-details/schema', 'GET'], ['/.cratis/users', 'GET'],
            ['/.cratis/tenants', 'GET'], ['/openapi.json', 'GET'],
            ['/.cratis/queries/ws', 'GET'], ['/.cratis/queries/sse', 'GET'],
            ['/.cratis/queries/sse/subscribe', 'POST'], ['/.cratis/queries/sse/unsubscribe', 'POST']
        ]);
        if (options.identityDetails) endpoints.set('/.cratis/me', 'GET');
        const reserved = new Set([...endpoints.keys(), '/.cratis/me']);
        for (const operation of [...this.commands, ...this.queries]) {
            const name = `${operation.namespace ?? ''}.${operation.name}`.toLowerCase();
            if (names.has(name)) throw new Error(`Duplicate Arc operation: ${name}`);
            names.add(name);
            if (routes.has(operation.route) || reserved.has(operation.route) ||
                (operation.kind === 'command' && (routes.has(operation.route + '/validate') || reserved.has(operation.route + '/validate'))))
                throw new Error(`Duplicate Arc route: ${operation.route}`);
            routes.set(operation.route, operation);
            endpoints.set(operation.route, operation.kind === 'command' ? 'POST' : options.enableQueryMethod === false ? 'GET' : 'GET, QUERY');
            if (operation.kind === 'command') {
                routes.set(operation.route + '/validate', operation);
                endpoints.set(operation.route + '/validate', 'POST');
            }
        }
        this.routes = routes;
        this.endpoints = endpoints;
        this.#hub = new ObservableQueryHub(this);
    }

    /** Complete both provider and operation executions through the same scope and registry shutdown boundary. */
    private async runOwned<T>(context: ExecutionContext, callback: () => T | Promise<T>,
        isSuccess: (value: T) => boolean, fail: (error: unknown, previous?: T) => T): Promise<T> {
        const scope = this.services.createScope(context);
        return this.services.runExecution(() => requestContext.run(context, () => withServices(scope, async () => {
            let result: T;
            try { result = await callback(); }
            catch (error) { result = fail(error); }
            try { await scope.dispose(); }
            catch (error) { result = fail(error, result); }
            if (isSuccess(result) && this.services.singletonFailed)
                result = fail(new Error('Service registry is disposed'), result);
            return result;
        })), async (initial, hasLivingAncestor) => {
            let result = initial;
            const checkAvailability = (): void => {
                if (isSuccess(result) && this.services.singletonFailed)
                    result = fail(new Error('Service registry is disposed'), result);
            };
            checkAvailability();
            if (this.services.singletonFailed && !hasLivingAncestor) {
                try { await this.services.dispose(); }
                catch (error) { result = fail(error, result); }
            }
            checkAvailability();
            return result;
        });
    }

    private async runProvider<T>(context: ExecutionContext, callback: () => T | Promise<T>): Promise<T> {
        type Outcome = { failed: false; value: T } | { failed: true; error: unknown };
        const outcome = await this.runOwned<Outcome>(context, async () => {
            try { return { failed: false, value: await callback() }; }
            catch (error) { return { failed: true, error }; }
        }, value => !value.failed, (error, previous) => ({ failed: true, error: previous?.failed
            ? new AggregateError([previous.error, error], 'Provider and cleanup failed') : error }));
        if (outcome.failed) throw outcome.error;
        return outcome.value;
    }

    private runScoped(operation: Operation, input: unknown, context: ExecutionContext, options?: QueryOptions, validateOnly = false): Promise<CommandResult | QueryResult> {
        return this.runOwned(context, async () => {
            try { return await operation.run(input, context, options, validateOnly); }
            catch (error) {
                const result = operation.kind === 'command'
                    ? commandResult(context, { exceptionMessages: [String(error)] })
                    : queryResult(context, { exceptionMessages: [String(error)] });
                recordFailure(result, error);
                return result;
            }
        }, result => result.isSuccess, (error, previous) => {
            const result = operation.kind === 'command'
                ? commandResult(context, { ...previous, response: undefined, exceptionMessages: [...previous?.exceptionMessages ?? [], String(error)] })
                : queryResult(context, { ...previous, data: undefined, exceptionMessages: [...previous?.exceptionMessages ?? [], String(error)] });
            recordFailure(result, error, previous);
            return result;
        });
    }

    /** Internal transport boundary: preserve cleanup failures for the owning server's shutdown verdict. */
    recordObservableCleanupFailure(error: unknown): void { this.#observableCleanupFailures.push(error); }

    async dispose(): Promise<void> {
        this.#disposed = true;
        const activeHubConnections = this.#hub.connections.length;
        const hubClosing = this.#hub.dispose();
        const closing = closeNodeWebSockets(this);
        const sessions = [...new Set([...this.#observableSessions, ...this.#snapshotSessions, ...this.#retiringSessions])];
        if (!sessions.length && !closing && !activeHubConnections && !this.#observableCleanupFailures.length) {
            if (this.#ownsServices) await this.services.dispose();
            return;
        }
        const failures: unknown[] = [];
        if (activeHubConnections) {
            try { await hubClosing; }
            catch (error) { failures.push(error); }
        }
        if (closing) {
            try { await closing; }
            catch (error) { failures.push(error); }
        }
        const outcomes = await Promise.allSettled(sessions.map(session => session.close()));
        failures.push(...outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason as unknown));
        if (this.#ownsServices) {
            try { await this.services.dispose(); }
            catch (error) { failures.push(error); }
        }
        failures.push(...this.#observableCleanupFailures);
        if (failures.length === 1) throw failures[0];
        if (failures.length) throw new AggregateError(failures, 'Observable query shutdown failed');
    }

    private callerKey(context: ExecutionContext): string { return observableCallerKey(context); }

    private hasSessionCapacity(context: ExecutionContext): boolean {
        const key = this.callerKey(context);
        const owned = [...this.#observableOwners.values()].filter(owner => owner === key).length;
        return !this.#disposed && this.observableLimits.hasSubscriptionCapacity(
            this.#observableSessions.size, this.#openingObservableSessions,
            owned, this.#openingOwners.get(key) ?? 0);
    }

    private reserveSession(session: ObservableQuerySession, context: ExecutionContext): void {
        const key = this.callerKey(context);
        if (!this.hasSessionCapacity(context)) throw new ObservableSubscriptionLimitError();
        this.#snapshotSessions.delete(session);
        this.#observableSessions.add(session);
        this.#observableOwners.set(session, key);
    }

    /** Open one query pipeline and service scope until its subscription ends. Caller must close it. */
    openObservableQuery(name: string, input: unknown, context: ExecutionContext, options?: QueryOptions): Promise<ObservableQuerySession> {
        return this.openSession(name, input, context, options, 'subscription');
    }

    private async openSession(name: string, input: unknown, context: ExecutionContext, options: QueryOptions | undefined,
        admission: 'subscription' | 'snapshot'): Promise<ObservableQuerySession> {
        if (this.#disposed) throw new Error('Arc server is disposed');
        if (context.signal.aborted) throw new Error('Observable subscription was canceled');
        const operation = this.queries.find(item => [item.namespace, item.name].filter(Boolean).join('.') === name);
        if (!operation || !isObservableOperation(operation)) throw new Error(`Unknown observable query: ${name}`);
        const key = this.callerKey(context);
        let releaseOwner = (): void => {};
        if (admission === 'subscription') {
            if (!this.hasSessionCapacity(context)) throw new ObservableSubscriptionLimitError();
            this.#openingOwners.set(key, (this.#openingOwners.get(key) ?? 0) + 1);
            this.#openingObservableSessions++;
            let ownerReleased = false;
            releaseOwner = (): void => {
                if (ownerReleased) return;
                ownerReleased = true;
                const remaining = (this.#openingOwners.get(key) ?? 1) - 1;
                if (remaining) this.#openingOwners.set(key, remaining);
                else this.#openingOwners.delete(key);
            };
            context.signal.addEventListener('abort', releaseOwner, { once: true });
            if (context.signal.aborted) releaseOwner();
        } else {
            if (++this.#openingSnapshots + this.#snapshotSessions.size > this.observableLimits.subscriptions) {
                this.#openingSnapshots--;
                throw new ObservableSubscriptionLimitError();
            }
        }
        try {
            const held: { session?: ObservableQuerySession } = {};
            const session = await ObservableQuerySession.open({
                operation, input, context, options, services: this.services,
                guards: this.options.observableEmissionGuards ?? [], development: this.options.development === true,
                pendingEmissions: this.observableLimits.pendingEmissions,
                reportFailure: error => Promise.resolve(this.options.logger?.(error, context.correlationId)),
                onRelease: () => {
                    if (!held.session) return;
                    this.#observableSessions.delete(held.session);
                    this.#snapshotSessions.delete(held.session);
                    this.#observableOwners.delete(held.session);
                    this.#retiringSessions.add(held.session);
                },
                onClose: () => {
                    if (!held.session) return;
                    this.#observableSessions.delete(held.session);
                    this.#snapshotSessions.delete(held.session);
                    this.#observableOwners.delete(held.session);
                    this.#retiringSessions.delete(held.session);
                }
            });
            held.session = session;
            if (this.#disposed || this.services.disposed) {
                await session.close();
                throw new Error('Arc server is disposed');
            }
            if (!session.rejection) {
                if (admission === 'snapshot') this.#snapshotSessions.add(session);
                else {
                    this.#observableSessions.add(session);
                    this.#observableOwners.set(session, key);
                }
            }
            return session;
        } finally {
            if (admission === 'snapshot') this.#openingSnapshots--;
            else {
                context.signal.removeEventListener('abort', releaseOwner);
                releaseOwner();
                this.#openingObservableSessions--;
            }
        }
    }

    /** Internal admission check before accepting a hub WebSocket upgrade. */
    canAdmitObservableHubConnection(context: ExecutionContext): boolean { return this.#hub.canAdmit(context); }

    /** Multiplexed socket entry point shared by all Node host bridges. */
    handleObservableHubSocket(request: Request, transport: ObservableSocket, native?: NativeRequestContext,
        resolved?: ResolvedConnectionContext): Promise<void> {
        return this.#hub.webSocket(request, transport, native, resolved);
    }

    async executeCommand(name: string, input: unknown, context: ExecutionContext, validateOnly = false): Promise<CommandResult> {
        const operation = this.commands.find(item => [item.namespace, item.name].filter(Boolean).join('.') === name);
        if (!operation) throw new Error(`Unknown command: ${name}`);
        return this.runScoped(operation, input, Object.freeze({ ...context }), undefined, validateOnly) as Promise<CommandResult>;
    }
    async performQuery(name: string, input: unknown, context: ExecutionContext, options?: QueryOptions): Promise<QueryResult> {
        const operation = this.queries.find(item => [item.namespace, item.name].filter(Boolean).join('.') === name);
        if (!operation) throw new Error(`Unknown query: ${name}`);
        const execution = Object.freeze({ ...context, allowedSeverity: Severity.Warning });
        if (!isObservableOperation(operation)) return this.runScoped(operation, input, execution, options) as Promise<QueryResult>;
        const session = await this.openObservableQuery(name, input, execution, options);
        try { return session.rejection ?? await session.current() ?? queryResult(execution, { isReady: false }); }
        finally { await session.close(); }
    }

    async handle(request: Request, native?: NativeRequestContext | (() => NativeRequestContext | Promise<NativeRequestContext>)): Promise<Response | null> {
        const path = new URL(request.url).pathname;
        if (path === '/.cratis/queries/ws') return new Response(null, { status: 426, headers: { upgrade: 'websocket' } });
        if (path === '/.cratis/queries/sse' || path === '/.cratis/queries/sse/subscribe' ||
            path === '/.cratis/queries/sse/unsubscribe')
            return this.#hub.http(request, typeof native === 'function' ? await native() : native);
        const operation = this.routes.get(path);
        if (!this.endpoints.has(path)) return null;
        const introspection = !operation;
        const header = this.options.correlationHeader ?? 'X-Correlation-ID';
        const correlationId = correlation(request.headers.get(header));
        const headers = new Headers({ [header]: correlationId });
        const send = (value: unknown, code: number, extra?: HeadersInit): Response => new Response(JSON.stringify(value), { status: code, headers: new Headers({ ...Object.fromEntries(headers), 'content-type': 'application/json; charset=utf-8', ...Object.fromEntries(new Headers(extra)) }) });
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
        if (introspection && request.method !== 'GET') return new Response(null, { status: 405, headers: new Headers({ ...Object.fromEntries(headers), allow: 'GET' }) });
        if (introspection && path !== '/.cratis/me' && path !== '/.cratis/users' && path !== '/.cratis/tenants') {
            if (path === '/.cratis/identity-details/schema') return send(this.#identitySchema ?? this.options.identityDetailsSchema ?? {}, 200);
            if (path === '/openapi.json') return send(this.openApi(), 200);
            return send((path === '/.cratis/commands' ? this.commands : this.queries).map(item => ({
                name: item.name, namespace: item.namespace ?? '', route: item.route, type: item.name,
                documentationSummary: item.summary ?? '', ...(item.kind === 'command' ? { payloadSchema: item.inputSchema } : {
                    fullyQualifiedName: [item.namespace, item.name].filter(Boolean).join('.'), argumentsSchema: item.inputSchema
                })
            })), 200);
        }
        const isIdentity = path === '/.cratis/me';
        const isDiscovery = path === '/.cratis/users' || path === '/.cratis/tenants';
        if (!operation && !isIdentity && !isDiscovery) return null;
        const isValidation = operation?.kind === 'command' && path === operation.route + '/validate';
        const allowed = this.endpoints.get(path)!;
        if (operation?.kind === 'command' ? request.method !== 'POST' : request.method !== 'GET' && (request.method !== 'QUERY' || this.options.enableQueryMethod === false))
            return new Response(null, { status: 405, headers: new Headers({ ...Object.fromEntries(headers), allow: allowed }) });
        if (request.method === 'QUERY' || isIdentity) headers.set('cache-control', 'no-store');
        let context: ExecutionContext = { correlationId, principal: undefined, tenantId: undefined, signal: request.signal, allowedSeverity: operation?.kind === 'command' ? clientAllowedSeverity(request.headers.get('X-Allowed-Severity')) : Severity.Warning };
        const serverFailure = (): Response => !operation ? send({ error: 'An unexpected error occurred' }, 500) : send(operation.kind === 'command'
            ? commandResult(context, { exceptionMessages: ['An unexpected error occurred'] })
            : queryResult(context, { exceptionMessages: ['An unexpected error occurred'] }), 500);
        try {
            const trustedNative = typeof native === 'function' ? await native() : native;
            const authentication = this.options.nativePrincipal
                ? { failed: false, principal: trustedNative?.principal === undefined ? undefined : verifiedPrincipal(trustedNative.principal) }
                : await authenticate(request, this.options.authentication ?? []);
            if (authentication.failed || ((this.options.nativePrincipal || this.options.authentication?.length) && !operation?.authorization?.anonymous &&
                (operation?.authorization?.authenticated || operation?.authorization?.roles?.length) && !authentication.principal?.isAuthenticated)) {
                if (!operation) return send({ error: 'Unauthorized' }, 401);
                const result = operation.kind === 'command' ? commandResult(context, { isAuthorized: false }) : queryResult(context, { isAuthorized: false });
                return send(result, 401);
            }
            if (isIdentity && !authentication.principal) return send({ error: 'Unauthorized' }, 401);
            const resolved = this.options.resolveTenant
                ? await this.options.resolveTenant(request, authentication.principal)
                : this.options.tenancy
                    ? resolveConfiguredTenant(request, authentication.principal, trustedNative, this.options.tenancy, this.options.tenantHeader ?? 'x-cratis-tenant-id')
                    : request.headers.get(this.options.tenantHeader ?? 'x-cratis-tenant-id') ?? undefined;
            const tenant = this.options.tenancy && !this.options.resolveTenant && resolved !== undefined ? tenantId(resolved) : resolved;
            context = Object.freeze({ ...context, principal: authentication.principal,
                tenantId: tenant, remoteAddress: trustedNative?.remoteAddress });
            return await requestContext.run(context, async () => {
                try {
                    if (isIdentity) {
                        const json = await this.runProvider(context, async () => {
                            const details = await this.options.identityDetails!.provide(authentication.principal!, context);
                            if (details === undefined) return undefined;
                            const parsed = this.options.identityDetails!.schema.parse(details);
                            const identity = { id: authentication.principal!.id, name: authentication.principal!.name ?? '', isAuthenticated: true, isAuthorized: true, roles: authentication.principal!.roles, details: parsed };
                            const serialized = JSON.stringify(identity);
                            // atob() in the existing client decodes bytes as Latin-1, not UTF-8.
                            const cookieJson = serialized.replace(/[\u007f-\uffff]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
                            const cookie = `.cratis-identity=${Buffer.from(cookieJson, 'ascii').toString('base64')}; Path=/; SameSite=Lax${trustedNative?.secure === true ? '; Secure' : ''}`;
                            if (Buffer.byteLength(cookie) > 4096) throw new Error('Identity details too large');
                            return { serialized, cookie };
                        });
                        if (json === undefined) return send({ error: 'Forbidden' }, 403);
                        return new Response(json.serialized, { status: 200, headers: new Headers({ ...Object.fromEntries(headers), 'content-type': 'application/json; charset=utf-8', 'set-cookie': json.cookie }) });
                    }
                    if (isDiscovery) {
                        const provider = path === '/.cratis/users' ? this.options.developmentUsers : this.options.developmentTenants;
                        if (!provider) return send([], 200);
                        const json = await this.runProvider(context, async () => {
                            const values: unknown = await provider(context);
                            const schema = path === '/.cratis/users'
                                ? z.array(z.object({ microsoftIdentity: z.object({ identityProvider: z.string().max(256), userId: z.string().max(256), userDetails: z.string().max(256), userRoles: z.array(z.string().max(256)).max(64), claims: z.array(z.object({ typ: z.string().max(256), val: z.string().max(256) })).max(64) }), details: z.unknown().optional() })).max(100)
                                : z.array(z.object({ id: z.string().max(256), name: z.string().max(256) })).max(100);
                            const serialized = JSON.stringify(schema.parse(values));
                            if (Buffer.byteLength(serialized) > 32 * 1024) throw new Error('Discovery output too large');
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
                        if (operation.kind === 'command') input = await body(request, this.options.maxBodyBytes ?? 1024 * 1024);
                        else if (request.method === 'GET') ({ input, options } = getQuery(new URL(request.url), operation.schema, isObservableOperation(operation)));
                        else ({ input, options } = structuredQuery(await body(request, this.options.maxBodyBytes ?? 1024 * 1024), operation.schema));
                    } catch (error) {
                        if (!(error instanceof BadRequest)) throw error;
                        const failure = operation.kind === 'command' ? commandResult(context, { validationResults: malformed(context) }) : queryResult(context, { validationResults: malformed(context) });
                        return send(failure, 400);
                    }
                    if (isObservableOperation(operation)) {
                        const name = [operation.namespace, operation.name].filter(Boolean).join('.');
                        const streaming = request.method === 'GET' &&
                            request.headers.get('accept')?.toLowerCase().includes('text/event-stream') === true;
                        const session = await this.openSession(name, input, context, options,
                            streaming ? 'subscription' : 'snapshot');
                        if (streaming) {
                            if (session.rejection) {
                                const rejected = session.rejection;
                                if (rejected.hasExceptions && !this.options.development) {
                                    rejected.exceptionMessages = ['An unexpected error occurred'];
                                    rejected.exceptionStackTrace = '';
                                }
                                return send(rejected, status(rejected));
                            }
                            return directSse(session, headers);
                        }
                        try {
                            const outcome = await snapshot(session, context, snapshotRequest.wait, snapshotRequest.timeoutMs,
                                () => this.reserveSession(session, context));
                            if (!outcome.protocol && outcome.result.hasExceptions && !this.options.development) {
                                outcome.result.exceptionMessages = ['An unexpected error occurred'];
                                outcome.result.exceptionStackTrace = '';
                            }
                            return send(outcome.result, outcome.code);
                        } finally { await session.close(); }
                    }
                    const result = await this.runScoped(operation, input, context, options, isValidation);
                    if (hasFailure(result) && !await logFailure(originalFailure(result))) return serverFailure();
                    if (result.exceptionMessages.length) {
                        if (!this.options.development) {
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
    }
    openApi(): Record<string, unknown> {
        const paths: Record<string, unknown> = {};
        for (const operation of [...this.commands, ...this.queries]) {
            const method = operation.kind === 'command' ? 'post' : 'get';
            paths[operation.route] = { [method]: {
                operationId: [operation.namespace, operation.name].filter(Boolean).join('.'), summary: operation.summary ?? '',
                ...(operation.kind === 'command' ? { requestBody: { required: true, content: { 'application/json': { schema: operation.inputSchema } } } } : {
                    parameters: Object.entries(operation.inputSchema.properties as Record<string, unknown> ?? {}).map(([name, schema]) => ({ name, in: 'query', required: (operation.inputSchema.required as string[] ?? []).includes(name), schema }))
                }), responses: { '200': { description: isObservableOperation(operation) ? 'Snapshot or direct SSE stream' : 'Result',
                    ...(isObservableOperation(operation) ? { content: { 'text/event-stream': { schema: { type: 'string' } } } } : {}) },
                    ...(isObservableOperation(operation) ? {
                        '202': { description: 'No current value' }, '408': { description: 'First-result wait timed out' },
                        '503': { description: 'Subscription limit reached' }
                    } : {}),
                    '400': { description: 'Invalid request' }, '403': { description: 'Not authorized' },
                    '500': { description: 'Server error' } }
            } };
        }
        return { openapi: '3.1.0', info: { title: 'Arc', version: '0.1.0' }, paths };
    }
}
