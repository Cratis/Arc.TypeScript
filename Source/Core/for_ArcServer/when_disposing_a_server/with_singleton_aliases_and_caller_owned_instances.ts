// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when disposing a server with singleton aliases and caller owned instances', () => {
    let success: boolean; let beforeShutdown: string[]; let afterShutdown: string[];
    beforeEach(async () => {
        const original = serviceToken<object>('singleton original'); const alias = serviceToken<object>('scoped alias');
        const supplied = serviceToken<object>('caller-owned'); const suppliedAlias = serviceToken<object>('caller alias');
        const calls: string[] = [];
        const provided = { [Symbol.dispose]: () => { calls.push('caller'); } };
        const server = new ArcServer({ services: [
            { token: original, lifetime: ServiceLifetime.Singleton,
                factory: () => ({ [Symbol.dispose]: () => { calls.push('singleton'); } }) },
            { token: alias, lifetime: ServiceLifetime.Scoped, dependencies: [original], factory: resolver => resolver.resolve(original) },
            { token: supplied, lifetime: ServiceLifetime.Singleton, instance: provided },
            { token: suppliedAlias, lifetime: ServiceLifetime.Scoped, dependencies: [supplied],
                factory: resolver => resolver.resolve(supplied) }
        ], queries: [defineQuery({ name: 'Aliases', schema: z.object({}), handlerDependencies: [alias, suppliedAlias], perform: () => true })] });
        success = (await server.performQuery('Aliases', {}, serviceContext('alpha'))).isSuccess;
        beforeShutdown = [...calls];
        await server.dispose(); afterShutdown = [...calls];
    });
    it('should not dispose aliases or caller supplied instances', () => {
        success.should.equal(true); beforeShutdown.should.deep.equal([]);
        afterShutdown.should.deep.equal(['singleton']);
    });
});
