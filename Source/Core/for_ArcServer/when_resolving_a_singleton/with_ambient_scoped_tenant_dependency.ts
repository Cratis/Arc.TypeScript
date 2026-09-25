// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { captureFailure, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when resolving a singleton with ambient scoped tenant dependency', () => {
    let firstSuccess: boolean; let firstData: unknown; let scopedCalls: number; let secondFailure: unknown;
    beforeEach(async () => {
        const scoped = serviceToken<{ tenant: string | undefined }>('tenant dependency');
        const singleton = serviceToken<{ tenant: string | undefined }>('tenant capture'); scopedCalls = 0;
        const server = new ArcServer({ services: [
            { token: scoped, lifetime: ServiceLifetime.Scoped, factory: (_resolver,
                identity) => { scopedCalls++; return { tenant: identity.tenantId }; } },
            { token: singleton, lifetime: ServiceLifetime.Singleton,
                factory: async () => ({ tenant: (await currentServices().resolve(scoped)).tenant }) }
        ], queries: [defineQuery({ name: 'CapturedTenant', schema: z.object({}), handlerDependencies: [singleton],
            perform: async () => (await currentServices().resolve(singleton)).tenant })] });
        const alpha = await server.performQuery('CapturedTenant', {}, serviceContext('alpha'));
        firstSuccess = alpha.isSuccess; firstData = alpha.data;
        secondFailure = await captureFailure(server.performQuery('CapturedTenant', {}, serviceContext('beta')));
        await server.dispose();
    });
    it('should reject ambient captive resolution without creating a scoped service', () => {
        firstSuccess.should.equal(false); (firstData === undefined).should.equal(true);
        scopedCalls.should.equal(0);
    });
    it('should reject later tenant executions after singleton failure', () => (secondFailure as Error).message.should.match(/disposed/));
});
