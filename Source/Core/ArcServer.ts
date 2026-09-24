// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { CommandResult, ExecutionContext, QueryOptions, QueryResult } from './index.js';
import type { ArcServerOptions } from './ArcServerOptions.js';
import { ownMetadata } from './reflection/ownMetadata.js';
import { encode, objectSchema } from './reflection/wireSchema.js';
import type { NativeRequestContext } from './http/NativeRequestContext.js';
import { validateTenancy } from './tenancy/validateTenancy.js';
import { handleRequest } from './http/handleRequest.js';
import { createRouteTable } from './http/createRouteTable.js';
import { renderOpenApi } from './openApi/renderOpenApi.js';
import type { Operation } from './http/Operation.js';
import { commandResult, queryResult } from './results/index.js';
import { recordFailure } from './results/failureTracking.js';
import { Severity } from './validation/Severity.js';
import { ServiceRegistry } from './dependencyInjection/ServiceRegistry.js';
import { withServices } from './dependencyInjection/ServiceScope.js';
import { requestContext } from './execution/RequestContextStore.js';
import { isObservableOperation } from './queries/observable/ObservableOperation.js';
import { CommandOperationBoundary } from './commands/CommandOperationBoundary.js';
import type { ObservableQuerySession } from './queries/observable/ObservableQuerySession.js';
import { ObservableSessions } from './queries/ObservableSessions.js';
import { closeNodeWebSockets } from './queries/observable/attachNodeWebSockets.js';
import { ObservableLimits } from './queries/observable/ObservableLimits.js';
import { ObservableQueryHub } from './queries/observable/ObservableQueryHub.js';
import type { ObservableSocket } from './queries/observable/ObservableSocket.js';
import type { ResolvedConnectionContext } from './queries/observable/ResolvedConnectionContext.js';
import { registerObservableCleanup } from './queries/observable/observableCleanupFailures.js';
import { observe } from './observability.js';
export function currentContext(): ExecutionContext | undefined { return requestContext.getStore(); }
export class ArcServer {
    readonly commands: readonly Operation[];
    readonly queries: readonly Operation[];
    readonly routes: ReadonlyMap<string, Operation>;
    /** All root-owned endpoints and their allowed methods. Adapters use this for raw path dispatch. */
    readonly endpoints: ReadonlyMap<string, string>;
    readonly options: ArcServerOptions;
    readonly services: ServiceRegistry;
    /** @internal Hosting transport budgets. */
    readonly observableLimits: ObservableLimits;
    readonly #ownsServices: boolean;
    readonly #identitySchema: Record<string, unknown> | undefined;
    readonly #hub: ObservableQueryHub;
    readonly #sessions: ObservableSessions;

    constructor(options: ArcServerOptions) {
        const detailsSchema = options.identityDetails?.schema ?? (options.identityDetails?.detailsType
            ? objectSchema(options.identityDetails.detailsType) : undefined);
        this.options = detailsSchema && options.identityDetails ? {
            ...options, identityDetails: { ...options.identityDetails, schema: detailsSchema }
        } : options;
        if (options.correlationHeader !== undefined && !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(options.correlationHeader))
            throw new Error('Invalid correlation header');
        if (options.commandCompensationTimeoutMs !== undefined &&
            (!Number.isSafeInteger(options.commandCompensationTimeoutMs) || options.commandCompensationTimeoutMs < 1 ||
                options.commandCompensationTimeoutMs > 4_294_967_294))
            throw new Error('Compensation timeout must be positive and at most 4294967294 milliseconds');
        validateTenancy(options.tenancy);
        if (options.nativePrincipal && options.authentication?.length) throw new Error('Native principal and Arc authentication handlers cannot be combined');
        if (options.identityDetails && (!(detailsSchema instanceof z.ZodType) || typeof options.identityDetails.provide !== 'function' || options.identityDetailsSchema))
            throw new Error('Identity details require a provider schema; legacy schema cannot be combined');
        if ((options.developmentUsers || options.developmentTenants) && !options.development) throw new Error('Discovery providers require development mode');
        this.#identitySchema = detailsSchema ? z.toJSONSchema(detailsSchema) : undefined;
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
        for (const token of [...options.queryRenderers ?? [], ...options.readModelInterceptors ?? []]) {
            if (this.services.registration(token).lifetime === 'singleton')
                throw new Error(`Query renderer or read-model interceptor ${this.services.registration(token).token.name} must not be singleton`);
        }
        if (options.maxBodyBytes !== undefined && (!Number.isSafeInteger(options.maxBodyBytes) || options.maxBodyBytes <= 0))
            throw new Error('Invalid maximum body size');
        if (options.observableKeepAliveIntervalMs !== undefined &&
            (!Number.isSafeInteger(options.observableKeepAliveIntervalMs) || options.observableKeepAliveIntervalMs < 0 ||
                options.observableKeepAliveIntervalMs > 120_000)) throw new Error('Invalid observable keep-alive interval');
        if (options.enableObservableHealth !== undefined && typeof options.enableObservableHealth !== 'boolean')
            throw new Error('Invalid observable health option');
        const table = createRouteTable(options, context => this.#hub.observeHealth(context));
        this.commands = table.commands;
        this.queries = table.queries;
        this.routes = table.routes;
        this.endpoints = table.endpoints;
        this.#hub = new ObservableQueryHub(this);
        this.#sessions = new ObservableSessions(options, this.services, this.observableLimits, () => this.queries);
        registerObservableCleanup(this, this.#sessions);
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
        if (operation.kind === 'command' && CommandOperationBoundary.attempt(this))
            return Promise.resolve(commandResult(context, { exceptionMessages: ['Nested commands are unsupported in command operations'] }));
        const run = () => this.runOwned(context, async () => {
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
        const name = operation.kind === 'command' ? validateOnly ? 'cratis.arc.command.validate' : 'cratis.arc.command.execute' : 'cratis.arc.query.perform';
        const qualified = [operation.namespace, operation.name].filter(Boolean).join('.');
        const attributes = operation.kind === 'command' ? { command_type: qualified } : { query_name: qualified };
        const traced = () => observe(name, context.correlationId, attributes, run, undefined, result => result.hasExceptions);
        return operation.kind === 'command' ? CommandOperationBoundary.command(this, traced) : traced();
    }

    async dispose(): Promise<void> {
        this.#sessions.markDisposed();
        const activeHubConnections = this.#hub.connections.length;
        const hubClosing = this.#hub.dispose();
        const closing = closeNodeWebSockets(this);
        const sessions = this.#sessions.sessions;
        if (!sessions.length && !closing && !activeHubConnections) {
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
        if (failures.length === 1) throw failures[0];
        if (failures.length) throw new AggregateError(failures, 'Observable query shutdown failed');
    }

    /** Open one query pipeline and service scope until its subscription ends. Caller must close it. */
    openObservableQuery(name: string, input: unknown, context: ExecutionContext, options?: QueryOptions): Promise<ObservableQuerySession> {
        return this.#sessions.openSession(name, input, context, options, 'subscription');
    }

    /** @internal Admission check for hosting adapters. */
    canAdmitObservableHubConnection(context: ExecutionContext): boolean { return this.#hub.canAdmit(context); }

    /** @internal Multiplexed socket entry point shared by Node hosts. */
    handleObservableHubSocket(request: Request, transport: ObservableSocket, native?: NativeRequestContext,
        resolved?: ResolvedConnectionContext): Promise<void> {
        return this.#hub.webSocket(request, transport, native, resolved);
    }

    /** Execute a decorated command instance through the ordinary direct-call pipeline. */
    async execute(command: object, context: ExecutionContext, validateOnly = false): Promise<CommandResult> {
        const type = command.constructor;
        if (!ownMetadata(type as never).command) throw new Error(`Not an Arc command: ${type.name}`);
        const matches = this.commands.filter(item => item.name === type.name);
        if (matches.length !== 1) throw new Error(`Ambiguous or unregistered Arc command: ${type.name}`);
        const operation = matches[0]!;
        return this.executeCommand([operation.namespace, operation.name].filter(Boolean).join('.'), encode(command), context, validateOnly);
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
        return handleRequest(this, {
            identitySchema: this.#identitySchema,
            hubHttp: (incoming, context) => this.#hub.http(incoming, context),
            runProvider: (context, callback) => this.runProvider(context, callback),
            runScoped: (operation, input, context, options, validateOnly) => this.runScoped(operation, input, context, options, validateOnly),
            openSession: (name, input, context, options, admission) => this.#sessions.openSession(name, input, context, options, admission),
            reserveSession: (session, context) => this.#sessions.reserveSession(session, context)
        }, request, native);
    }
    openApi(): Record<string, unknown> { return renderOpenApi(this.commands, this.queries); }
}
