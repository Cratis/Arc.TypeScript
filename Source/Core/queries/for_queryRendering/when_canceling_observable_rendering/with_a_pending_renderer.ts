// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { defineObservableQuery } from '../../observable/defineObservableQuery.js';
import { CurrentValueSubject } from '../../observable/CurrentValueSubject.js';
import type { QueryResult } from '../../QueryResult.js';
import type { QueryRenderer } from '../../QueryRenderer.js';
import type { ReadModelInterceptor } from '../../ReadModelInterceptor.js';
import { ServiceLifetime } from '../../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../../dependencyInjection/ServiceToken.js';
should();

describe('when canceling during an observable emission renderer', () => {
    let calls: string[];
    let result: QueryResult;
    beforeEach(async () => {
        calls = [];
        const controller = new AbortController();
        let started!: () => void;
        let release!: () => void;
        const rendering = new Promise<void>(resolve => { started = resolve; });
        const resume = new Promise<void>(resolve => { release = resolve; });
        const renderer = serviceToken<QueryRenderer>('renderer');
        const interceptor = serviceToken<ReadModelInterceptor>('interceptor');
        const server = new ArcServer({
            services: [
                { token: renderer, lifetime: ServiceLifetime.Scoped, factory: () => ({
                    canRender: () => true, render: async () => {
                        calls.push('render'); started(); await resume; return { value: 'visible' };
                    }, [Symbol.dispose]: () => { calls.push('dispose renderer'); }
                }) },
                { token: interceptor, lifetime: ServiceLifetime.Scoped, factory: () => ({
                    model: Object, intercept: (value: object) => { calls.push('intercept'); return value; },
                    [Symbol.dispose]: () => { calls.push('dispose interceptor'); }
                }) }
            ], queryRenderers: [renderer], readModelInterceptors: [interceptor],
            observableQueries: [defineObservableQuery({ name: 'Watch', schema: z.object({}),
                observe: () => CurrentValueSubject.of('provider') })]
        });
        const pending = server.performQuery('Watch', {}, { correlationId: 'observable-render-cancel',
            principal: undefined, tenantId: undefined, signal: controller.signal, allowedSeverity: 2 });
        await rendering;
        controller.abort(new Error('canceled'));
        release();
        result = await pending;
        await server.dispose();
    });
    it('should not invoke the next interceptor', () => { calls.should.not.include('intercept'); });
    it('should fail and release the subscription scope', () => {
        result.isSuccess.should.equal(false);
        calls.should.include('dispose renderer');
    });
});
