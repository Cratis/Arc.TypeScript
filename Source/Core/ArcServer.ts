// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from './commands/CommandResult.js';
import type { ExecutionContext } from './execution/ExecutionContext.js';
import type { QueryOptions } from './queries/QueryOptions.js';
import type { QueryResult } from './queries/QueryResult.js';
import type { ArcOptions } from './ArcOptions.js';
import { ownMetadata } from './reflection/ownMetadata.js';
import { withGeneratedMetadata } from './reflection/registerGeneratedMetadata.js';
import type { ArtifactMetadata } from './reflection/ArtifactMetadata.js';
import type { ClassType } from './reflection/ClassType.js';
import { encode } from './reflection/wireSchema.js';
import type { NativeRequestContext } from './http/NativeRequestContext.js';
import { validateOptions, validateRegistryOptions, validateTransportOptions } from './validateOptions.js';
import { handleRequest } from './http/handleRequest.js';
import { createRouteTable } from './http/createRouteTable.js';
import { renderOpenApi } from './openApi/renderOpenApi.js';
import type { Operation } from './http/Operation.js';
import { commandResult } from './commands/createCommandResult.js';
import { queryResult } from './queries/createQueryResult.js';
import { recordFailure } from './execution/failureTracking.js';
import { Severity } from './validation/Severity.js';
import { ServiceRegistry } from './dependencyInjection/ServiceRegistry.js';
import { withServices } from './dependencyInjection/ServiceScope.js';
import { requestContext } from './execution/RequestContextStore.js';
import { isObservableOperation } from './queries/observable/ObservableOperation.js';
import { CommandOperationBoundary } from './commands/CommandOperationBoundary.js';
import type { ObservableQuerySession } from './queries/observable/ObservableQuerySession.js';
import { ObservableSessions } from './queries/observable/ObservableSessions.js';
import { ObservableLimits } from './queries/observable/ObservableLimits.js';
import { ObservableQueryHub } from './queries/observable/ObservableQueryHub.js';
import type { ObservableSocket } from './queries/observable/ObservableSocket.js';
import type { ResolvedConnectionContext } from './queries/observable/ResolvedConnectionContext.js';
import { registerObservableCleanup } from './queries/observable/observableCleanupFailures.js';
import { observe } from './execution/observability.js';
export function currentContext(): ExecutionContext | undefined { return requestContext.getStore(); }
enum OperationMode { Execute, Validate }
export class ArcServer {
    readonly commands: readonly Operation[];
    readonly queries: readonly Operation[];
    readonly routes: ReadonlyMap<string, Operation>;
    readonly #commandsByName: ReadonlyMap<string, Operation>;
    readonly #queriesByName: ReadonlyMap<string, Operation>;
    /** All root-owned endpoints and their allowed methods. Adapters use this for raw path dispatch. */
    readonly endpoints: ReadonlyMap<string, string>;
    readonly options: ArcOptions;
    readonly services: ServiceRegistry;
    /** @internal Hosting transport budgets. */
    readonly observableLimits: ObservableLimits;
    readonly #ownsServices: boolean;
    /** @internal Optional Node WebSocket bridge shutdown. */
    closeWebSockets?: () => Promise<void>;
    readonly #identitySchema: Record<string, unknown> | undefined;
    readonly #hub: ObservableQueryHub;
    readonly #sessions: ObservableSessions;
    readonly #generatedMetadata?: ReadonlyMap<ClassType, ArtifactMetadata>;

    constructor(options: ArcOptions, generatedMetadata?: ReadonlyMap<ClassType, ArtifactMetadata>) {
        this.#generatedMetadata = generatedMetadata;
        const validated = validateOptions(options);
        this.options = validated.options;
        this.#identitySchema = validated.identitySchema;
        this.observableLimits = validated.observableLimits;
        this.#ownsServices = !(options.services instanceof ServiceRegistry);
        this.services = options.services instanceof ServiceRegistry ? options.services : new ServiceRegistry(options.services);
        validateRegistryOptions(options, this.services);
        validateTransportOptions(options);
        const table = createRouteTable(options, context => this.#hub.observeHealth(context));
        this.commands = table.commands;
        this.queries = table.queries;
        this.#commandsByName = new Map(this.commands.map(operation => [operation.fullyQualifiedName, operation]));
        this.#queriesByName = new Map(this.queries.map(operation => [operation.fullyQualifiedName, operation]));
        this.routes = table.routes;
        this.endpoints = table.endpoints;
        this.#hub = new ObservableQueryHub(this);
        this.#sessions = new ObservableSessions(options, this.services, this.observableLimits, () => this.#queriesByName);
        registerObservableCleanup(this, this.#sessions);
    }

    /** Complete both provider and operation executions through the same scope and registry shutdown boundary. */
    private async runOwned<T>(context: ExecutionContext, callback: () => T | Promise<T>,
        isSuccess: (value: T) => boolean, fail: (error: unknown, previous?: T) => T): Promise<T> {
        const scope = this.services.createScope(context);
        return withGeneratedMetadata(this.#generatedMetadata, () => this.services.runExecution(() => requestContext.run(context, () => withServices(scope, async () => {
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
        }));
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

    private runScoped(operation: Operation, input: unknown, context: ExecutionContext, options?: QueryOptions,
        mode = OperationMode.Execute): Promise<CommandResult | QueryResult> {
        if (operation.kind === 'command' && CommandOperationBoundary.attempt(this))
            return Promise.resolve(commandResult(context, { exceptionMessages: ['Nested commands are unsupported in command operations'] }));
        const run = () => this.runOwned(context, async () => {
            try {
                if (mode === OperationMode.Validate) return await operation.validateCommand!(input, context);
                return await operation.run(input, context, options);
            }
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
        const name = operation.kind === 'query' ? 'cratis.arc.query.perform' :
            mode === OperationMode.Validate ? 'cratis.arc.command.validate' : 'cratis.arc.command.execute';
        const qualified = operation.fullyQualifiedName;
        const attributes = operation.kind === 'command' ? { command_type: qualified } : { query_name: qualified };
        const traced = () => observe(name, context.correlationId, attributes, run, undefined, result => result.hasExceptions);
        return operation.kind === 'command' ? CommandOperationBoundary.command(this, traced) : traced();
    }

    async dispose(): Promise<void> {
        this.#sessions.markDisposed();
        const activeHubConnections = this.#hub.connections.length;
        const hubClosing = this.#hub.dispose();
        const closing = this.closeWebSockets?.();
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

    /** @internal Look up a query by its namespace-qualified name for hosting transports. */
    queryOperation(name: string): Operation | undefined { return this.#queriesByName.get(name); }

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

    private operationFor(command: object): Operation {
        const type = command.constructor;
        if (!ownMetadata(type as never).command) throw new Error(`Not an Arc command: ${type.name}`);
        const matches = this.commands.filter(item => item.name === type.name);
        if (matches.length !== 1) throw new Error(`Ambiguous or unregistered Arc command: ${type.name}`);
        return matches[0]!;
    }

    /** Execute a decorated command instance through the ordinary direct-call pipeline. */
    async execute(command: object, context: ExecutionContext): Promise<CommandResult> {
        return this.executeCommand(this.operationFor(command).fullyQualifiedName, encode(command), context);
    }
    /** Validate a decorated command without running provide, handle, or execution scopes. */
    async validate(command: object, context: ExecutionContext): Promise<CommandResult> {
        return this.validateCommand(this.operationFor(command).fullyQualifiedName, encode(command), context);
    }
    /** Execute a registered command by its fully qualified name. */
    async executeCommand(name: string, input: unknown, context: ExecutionContext): Promise<CommandResult> {
        const operation = this.#commandsByName.get(name);
        if (!operation) throw new Error(`Unknown command: ${name}`);
        return this.runScoped(operation, input, Object.freeze({ ...context })) as Promise<CommandResult>;
    }
    /** Validate a registered command by its fully qualified name, without running its handler. */
    async validateCommand(name: string, input: unknown, context: ExecutionContext): Promise<CommandResult> {
        const operation = this.#commandsByName.get(name);
        if (!operation) throw new Error(`Unknown command: ${name}`);
        return this.runScoped(operation, input, Object.freeze({ ...context }), undefined, OperationMode.Validate) as Promise<CommandResult>;
    }
    async performQuery(name: string, input: unknown, context: ExecutionContext, options?: QueryOptions): Promise<QueryResult> {
        const operation = this.#queriesByName.get(name);
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
            runScoped: (operation, input, context, options) => this.runScoped(operation, input, context, options),
            validateCommand: (operation, input, context) => this.runScoped(operation, input, context, undefined,
                OperationMode.Validate) as Promise<CommandResult>,
            openSession: (name, input, context, options, admission) => this.#sessions.openSession(name, input, context, options, admission),
            reserveSession: (session, context) => this.#sessions.reserveSession(session, context)
        }, request, native);
    }
    openApi(): Record<string, unknown> { return renderOpenApi(this.commands, this.queries, this.options); }
}
