// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { beforeDeadline, captureFailure, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when failing a nested singleton with a failing disposer', () => {
    let innerFailed: boolean; let resultSuccess: boolean; let data: unknown; let messages: string;
    let events: string[]; let disposalFailure: unknown;
    beforeEach(async () => {
        const active = serviceToken<object>('outer active'); const partial = serviceToken<object>('inner partial singleton');
        const broken = serviceToken<object>('inner broken singleton'); events = [];
        const server = new ArcServer({ services: [
            { token: active, lifetime: ServiceLifetime.Scoped,
                factory: () => ({ [Symbol.dispose]: () => { events.push('outer disposed'); } }) },
            { token: partial, lifetime: ServiceLifetime.Singleton,
                factory: () => ({ [Symbol.dispose]: () => { events.push('singleton disposed'); throw new Error('cleanup failed'); } }) },
            { token: broken, lifetime: ServiceLifetime.Singleton, dependencies: [partial], factory: async resolver => {
                await resolver.resolve(partial); throw new Error('singleton failed');
            } }
        ], queries: [
            defineQuery({ name: 'Outer', schema: z.object({}), handlerDependencies: [active], perform: async () => {
                innerFailed = !(await server.performQuery('Inner', {}, serviceContext('beta'))).isSuccess;
                events.push('inner returned'); return 'sensitive';
            } }),
            defineQuery({ name: 'Inner', schema: z.object({}), handlerDependencies: [broken], perform: () => 'unexpected' })
        ] });
        try {
            const result = await beforeDeadline(server.performQuery('Outer', {}, serviceContext('alpha')), 'nested shutdown');
            resultSuccess = result.isSuccess; data = result.data; messages = result.exceptionMessages.join(' ');
        } finally { disposalFailure = await captureFailure(server.dispose()); }
    });
    it('should unwind the nested failure without returning sensitive data', () => {
        innerFailed.should.equal(true); resultSuccess.should.equal(false);
        (data === undefined).should.equal(true);
        messages.should.match(/Service registry disposal failed/);
        events.should.deep.equal(['inner returned', 'outer disposed', 'singleton disposed']);
    });
    it('should report the failed cleanup on later disposal', () => (disposalFailure as Error).message.should.match(/Service registry disposal failed/));
});
