// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../ArcServer.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { QueryOptions } from '../queries/QueryOptions.js';
import type { Operation } from './Operation.js';
import type { RequestBindings } from './handleRequest.js';
import type { EndpointResponse } from './EndpointResponse.js';
import { BadRequest } from './BadRequest.js';
import { body } from './body.js';
import { getQuery, QueryValidationError, structuredQuery } from './queryBinding.js';
import { commandResult } from '../commands/createCommandResult.js';
import { queryResult } from '../queries/createQueryResult.js';
import { malformed } from './malformed.js';
import { status } from './status.js';
import { exposeExceptionDetails } from '../execution/exposeExceptionDetails.js';
import { hasFailure, originalFailure } from '../execution/failureTracking.js';
import { isObservableOperation } from '../queries/observable/ObservableOperation.js';
import { snapshot, snapshotOptions } from '../queries/observable/snapshot.js';
import { directSse } from '../queries/observable/directSse.js';

interface OperationInput {
    input: unknown;
    options?: QueryOptions;
    snapshotRequest: { wait: boolean; timeoutMs: number };
}

async function readInput(server: ArcServer, request: Request, operation: Operation): Promise<OperationInput> {
    let input: unknown; let options: QueryOptions | undefined;
    let snapshotRequest = { wait: false, timeoutMs: 30_000 };
    if (request.method === 'GET' && isObservableOperation(operation)) snapshotRequest = snapshotOptions(new URL(request.url));
    if (operation.kind === 'command') input = await body(request, server.options.hosting?.maxBodyBytes ?? 1024 * 1024);
    else if (request.method === 'GET') ({ input, options } = getQuery(new URL(request.url), operation.schema, isObservableOperation(operation)));
    else ({ input, options } = structuredQuery(
        await body(request, server.options.hosting?.maxBodyBytes ?? 1024 * 1024), operation.schema));
    return { input, options, snapshotRequest };
}

async function handleObservable(server: ArcServer, bindings: RequestBindings, operation: Operation, request: Request,
    context: ExecutionContext, response: EndpointResponse, { input, options, snapshotRequest }: OperationInput): Promise<Response> {
    const streaming = request.method === 'GET' && request.headers.get('accept')?.toLowerCase().includes('text/event-stream') === true;
    const session = await bindings.openSession(operation.fullyQualifiedName, input, context, options,
        streaming ? 'subscription' : 'snapshot');
    if (streaming) {
        if (session.rejection) {
            const rejected = session.rejection;
            if (rejected.hasExceptions && !exposeExceptionDetails(server.options)) {
                rejected.exceptionMessages = ['An unexpected error occurred'];
                rejected.exceptionStackTrace = '';
            }
            return response.send(rejected, status(rejected));
        }
        return directSse(session, response.headers);
    }
    try {
        const outcome = await snapshot(session, context, snapshotRequest.wait, snapshotRequest.timeoutMs,
            () => bindings.reserveSession(session, context));
        if (!outcome.protocol && outcome.result.hasExceptions && !exposeExceptionDetails(server.options)) {
            outcome.result.exceptionMessages = ['An unexpected error occurred'];
            outcome.result.exceptionStackTrace = '';
        }
        return response.send(outcome.result, outcome.code);
    } finally { await session.close(); }
}

/** Bind and run a command or query, including observable snapshot and SSE requests. */
export async function handleOperation(server: ArcServer, bindings: RequestBindings, operation: Operation, request: Request,
    context: ExecutionContext, response: EndpointResponse, logFailure: (error: unknown) => Promise<boolean>,
    serverFailure: () => Response): Promise<Response> {
    let bound: OperationInput;
    try {
        bound = await readInput(server, request, operation);
    } catch (error) {
        if (!(error instanceof BadRequest)) throw error;
        if (error instanceof QueryValidationError) return response.send(queryResult(context, { validationResults: [error.result] }), 400);
        if (operation.kind !== 'command' && request.method === 'QUERY') {
            return response.send(queryResult(context, { exceptionMessages: ['An unexpected error occurred'] }), 400);
        }
        const failure = operation.kind === 'command' ? commandResult(context, { validationResults: malformed(context) }) :
            queryResult(context, { validationResults: malformed(context) });
        return response.send(failure, 400);
    }
    if (isObservableOperation(operation)) return handleObservable(server, bindings, operation, request, context, response, bound);
    const path = new URL(request.url).pathname;
    const result = operation.kind === 'command' && path === operation.route + '/validate'
        ? await bindings.validateCommand(operation, bound.input, context)
        : await bindings.runScoped(operation, bound.input, context, bound.options);
    if (hasFailure(result) && !await logFailure(originalFailure(result))) return serverFailure();
    if (result.exceptionMessages.length && !exposeExceptionDetails(server.options)) {
        result.exceptionMessages = ['An unexpected error occurred'];
        result.exceptionStackTrace = '';
    }
    return response.send(result, status(result));
}
