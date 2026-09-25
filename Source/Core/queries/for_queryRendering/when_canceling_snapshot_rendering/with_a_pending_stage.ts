// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { defineQuery } from '../../defineQuery.js';
import type { QueryResult } from '../../QueryResult.js';
import type { QueryRenderer } from '../../QueryRenderer.js';
import type { ReadModelInterceptor } from '../../ReadModelInterceptor.js';
import { ServiceLifetime } from '../../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../../dependencyInjection/ServiceToken.js';
should();
function deferred() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}
class Task { constructor(readonly name: string) {} }
for (const stage of ['performer', 'renderer resolution', 'renderer', 'first interceptor'] as const) {
    describe(`when canceling during snapshot ${stage}`, () => {
        let calls: string[];
        let result: QueryResult;
        beforeEach(async () => {
            calls = [];
            const controller = new AbortController();
            const started = deferred();
            const release = deferred();
            const pause = async (at: typeof stage): Promise<void> => {
                if (stage !== at) return;
                started.release();
                await release.promise;
            };
            const renderer = serviceToken<QueryRenderer>('renderer');
            const first = serviceToken<ReadModelInterceptor>('first');
            const second = serviceToken<ReadModelInterceptor>('second');
            const server = new ArcServer({
                services: [
                    { token: renderer, lifetime: ServiceLifetime.Scoped, factory: async () => {
                        await pause('renderer resolution');
                        return { canRender: () => true, render: async () => {
                            calls.push('render'); await pause('renderer'); return new Task('rendered');
                        }, [Symbol.dispose]: () => { calls.push('dispose renderer'); } };
                    } },
                    { token: first, lifetime: ServiceLifetime.Scoped, factory: () => ({
                        model: Task, intercept: async (value: Task) => {
                            calls.push('first'); await pause('first interceptor'); return value;
                        }, [Symbol.dispose]: () => { calls.push('dispose first'); }
                    }) },
                    { token: second, lifetime: ServiceLifetime.Scoped, factory: () => ({
                        model: Task, intercept: (value: Task) => { calls.push('second'); return value; },
                        [Symbol.dispose]: () => { calls.push('dispose second'); }
                    }) }
                ], queryRenderers: [renderer], readModelInterceptors: [first, second],
                queries: [defineQuery({ name: 'Tasks', schema: z.object({}), perform: async () => {
                    calls.push('perform'); await pause('performer'); return 'provider';
                } })]
            });
            const pending = server.performQuery('Tasks', {}, { correlationId: 'render-cancel',
                principal: undefined, tenantId: undefined, signal: controller.signal, allowedSeverity: 2 });
            await started.promise;
            controller.abort(new Error('canceled'));
            release.release();
            result = await pending;
            await server.dispose();
        });
        it('should fail instead of delivering successful data', () => { result.isSuccess.should.be.false; });
        it('should not start the next rendering stage', () => {
            if (stage === 'performer' || stage === 'renderer resolution') calls.should.not.include('render');
            if (stage === 'renderer') calls.should.not.include('first');
            if (stage === 'first interceptor') calls.should.not.include('second');
        });
        it('should dispose the constructed renderer', () => {
            if (stage !== 'performer') calls.should.include('dispose renderer');
        });
    });
}
