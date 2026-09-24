// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { beforeDeadline, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when resolving nested dependencies with a singleton cycle through a scoped service', () => {
    let nestedSuccess: boolean; let cycleMessage: string; let outerSuccess: boolean; let outerData: unknown;
    beforeEach(async () => {
        const a = serviceToken<object>('singleton A'); const b = serviceToken<object>('nested scoped B');
        const server = new ArcServer({ services: [
            { token: a, lifetime: 'singleton', factory: async () => {
                const nested = await server.performQuery('B', {}, serviceContext('nested'));
                nestedSuccess = nested.isSuccess; cycleMessage = nested.exceptionMessages.join(' ');
                throw new Error('nested dependency failed');
            } },
            { token: b, lifetime: 'scoped', factory: resolver => resolver.resolve(a) }
        ], queries: [
            defineQuery({ name: 'A', schema: z.object({}), handlerDependencies: [a], perform: () => 'unexpected' }),
            defineQuery({ name: 'B', schema: z.object({}), handlerDependencies: [b], perform: () => 'unexpected' })
        ] });
        const result = await beforeDeadline(server.performQuery('A', {}, serviceContext('outer')), 'singleton A via nested B');
        outerSuccess = result.isSuccess; outerData = result.data;
        await beforeDeadline(server.dispose(), 'singleton A nested B disposal');
    });
    it('should detect the singleton cycle rather than a false scoped cycle', () => {
        nestedSuccess.should.equal(false);
        cycleMessage.should.match(/Service dependency cycle: singleton A/);
        outerSuccess.should.equal(false);
        (outerData === undefined).should.equal(true);
    });
});
