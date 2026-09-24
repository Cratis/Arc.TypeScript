// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../../ArcServer.js';
import { BadRequest } from '../../http/BadRequest.js';
import { getQuery } from '../../http/queryBinding.js';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';
import type { NativeRequestContext } from '../../http/NativeRequestContext.js';
import { malformed, queryResult } from '../../results/index.js';
import { correlation } from '../../execution/correlation.js';
import { Severity } from '../../validation/Severity.js';
import { isObservableOperation } from './ObservableOperation.js';
import { resolveConnectionContext } from './resolveConnectionContext.js';
import type { ResolvedConnectionContext } from './ResolvedConnectionContext.js';
import type { WebSocketTransport } from './WebSocketTransport.js';

/** The query route uses direct Data/Ping/Pong frames, never hub envelopes. */
export async function directWebSocket(server: ArcServer, request: Request, transport: WebSocketTransport,
    native?: NativeRequestContext, resolved?: ResolvedConnectionContext): Promise<void> {
    let context: ExecutionContext = {
        correlationId: correlation(request.headers.get(server.options.correlationHeader ?? 'X-Correlation-ID')),
        principal: undefined, tenantId: undefined, signal: transport.signal, allowedSeverity: Severity.Warning
    };
    try {
        const operation = server.routes.get(new URL(request.url).pathname);
        if (!operation || !isObservableOperation(operation)) throw new BadRequest();
        const identity = resolved ?? await resolveConnectionContext(server, request, native);
        context = Object.freeze({ ...identity.context,
            signal: AbortSignal.any([identity.context.signal, transport.signal]) });
        if (identity.authenticationFailed) {
            await transport.send({ type: 'Data', data: queryResult(context, { isAuthorized: false }) });
            return;
        }
        let input: unknown;
        let options;
        try { ({ input, options } = getQuery(new URL(request.url), operation.schema, true)); }
        catch (error) {
            if (!(error instanceof BadRequest)) throw error;
            await transport.send({ type: 'Data', data: queryResult(context, { validationResults: malformed(context) }) });
            return;
        }
        const name = [operation.namespace, operation.name].filter(Boolean).join('.');
        const session = await server.openObservableQuery(name, input, context, options);
        try {
            const outgoing = (async (): Promise<void> => {
                for await (const result of session.results()) await transport.send({ type: 'Data', data: result });
            })();
            const incoming = (async (): Promise<void> => {
                for await (const raw of transport) {
                    const message: unknown = JSON.parse(raw);
                    if (typeof message !== 'object' || !message || !('type' in message)) continue;
                    if (message.type !== 'Ping') continue;
                    const timestamp = 'timestamp' in message ? message.timestamp : undefined;
                    if (typeof timestamp === 'number' && Number.isSafeInteger(timestamp) && timestamp >= 0)
                        await transport.send({ type: 'Pong', timestamp });
                }
            })();
            let failure: unknown;
            try { await Promise.race([outgoing, incoming]); }
            catch (error) { failure = error; }
            transport.close();
            await session.close();
            const outcomes = await Promise.allSettled([outgoing, incoming]);
            const failures = outcomes.filter(outcome => outcome.status === 'rejected');
            if (failure || failures.length)
                throw new AggregateError(failures.map(outcome => outcome.reason), 'Observable WebSocket failed');
        } finally { await session.close(); }
    } catch (error) {
        try { await server.options.logger?.(error, context.correlationId); }
        catch { transport.close(); return; }
        if (!transport.signal.aborted) {
            try { await transport.send({ type: 'Data', data: queryResult(context, {
                exceptionMessages: ['An unexpected error occurred']
            }) }); }
            catch { /* The connection has already failed; no successful frame can be delivered. */ }
        }
    } finally { transport.close(); }
}
