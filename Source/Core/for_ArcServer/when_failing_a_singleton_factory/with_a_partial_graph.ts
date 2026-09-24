// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { captureFailure, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when failing a singleton factory with a partial graph', () => {
    let failed: boolean; let events: string[]; let subsequentFailure: unknown;
    beforeEach(async () => {
        events = []; const first = serviceToken<object>('first singleton'); const broken = serviceToken<object>('broken singleton');
        const server = new ArcServer({ services: [
            { token: first, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => { events.push('disposed'); } }) },
            { token: broken, lifetime: 'singleton', dependencies: [first], factory: async resolver => {
                await resolver.resolve(first); throw new Error('no singleton');
            } }
        ], queries: [defineQuery({ name: 'Broken', schema: z.object({}), handlerDependencies: [broken], perform: () => 1 })] });
        failed = !(await server.performQuery('Broken', {}, serviceContext('alpha'))).isSuccess;
        subsequentFailure = await captureFailure(server.performQuery('Broken', {}, serviceContext('beta')));
        await server.dispose();
    });
    it('should dispose the partial graph and fail the first query', () => {
        failed.should.equal(true); events.should.deep.equal(['disposed']);
    });
    it('should reject subsequent requests', () => (subsequentFailure as Error).message.should.match(/disposed/));
});
