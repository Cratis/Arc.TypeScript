// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { beforeDeadline, captureFailure, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();
const path = 'http://localhost/.cratis/queries/sse';

describe('when a disconnected SSE client has a scope failure after participant stop', () => {
    let failure: unknown;
    let original: Error;
    beforeEach(async () => {
        original = new Error('scope failed after cancellation');
        const entered = gate(); const canceled = gate();
        const token = serviceToken<object>('SSE scope');
        const server = new ArcServer({ query: { observableShutdownTimeoutMs: 250 },
            services: [{ token, lifetime: ServiceLifetime.Scoped,
                factory: () => ({ [Symbol.asyncDispose]: async () => {
                    entered.release(); await canceled.promise; throw original;
                } }) }],
            observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}), handlerDependencies: [token],
                observe: async () => { await currentServices().resolve(token); return new CurrentValueSubject(1); } })] });
        const response = (await server.handle(new Request(path)))!;
        const reader = response.body!.getReader();
        const connected = new TextDecoder().decode((await reader.read()).value);
        const connectionId = JSON.parse(connected.slice(6)).payload as string;
        const draining = (async () => { while (!(await reader.read()).done) { /* Keep deliveries flowing. */ } })();
        try {
            const subscription = await server.handle(new Request(`${path}/subscribe`, { method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ connectionId, queryId: 'q', request: { queryName: 'Live' } }) }));
            subscription?.status.should.equal(200);
            server.services.addShutdownParticipant({ stop: () => { canceled.release(); }, drain: async () => {} });
            await reader.cancel();
            await beforeDeadline(entered.promise, 'failing SSE disposer entry');
            failure = await beforeDeadline(captureFailure(server.dispose()), 'failing disconnected SSE shutdown');
            await draining;
        } finally { canceled.release(); await reader.cancel(); await captureFailure(server.dispose()); }
    });
    it('should report the eventual scope failure once without an earlier hub timeout', () => {
        const leaves = (error: unknown): unknown[] => error instanceof AggregateError && error.errors.length
            ? error.errors.flatMap(leaves) : [error];
        leaves(failure).should.deep.equal([original]);
    });
});
