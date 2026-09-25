// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { beforeDeadline, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when resolving a recursive singleton with a nested query', () => {
    let nestedSuccess: boolean; let nestedMessages: string; let success: boolean; let data: unknown; let events: string[];
    beforeEach(async () => {
        const singleton = serviceToken<object>('recursive singleton'); events = [];
        const server = new ArcServer({ services: [{ token: singleton, lifetime: ServiceLifetime.Singleton, factory: async () => {
            events.push('factory entered');
            const nested = await server.performQuery('Recursive', {}, serviceContext('inner'));
            nestedSuccess = nested.isSuccess; nestedMessages = nested.exceptionMessages.join(' ');
            throw new Error('nested singleton failed');
        } }], queries: [defineQuery({ name: 'Recursive', schema: z.object({}), handlerDependencies: [singleton], perform: () => {
            events.push('handler'); return 'unexpected';
        } })] });
        const result = await beforeDeadline(server.performQuery('Recursive', {}, serviceContext('outer')), 'recursive singleton shutdown');
        success = result.isSuccess; data = result.data;
        await beforeDeadline(server.dispose(), 'recursive singleton disposal');
    });
    it('should report a cycle without running the handler or hanging shutdown', () => {
        success.should.equal(false); nestedSuccess.should.equal(false);
        nestedMessages.should.match(/Service dependency cycle: recursive singleton/);
        (data === undefined).should.equal(true);
        events.should.deep.equal(['factory entered']);
    });
});
