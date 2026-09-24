// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, currentContext } from '../../ArcServer.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when entering nested executions with a service factory', () => {
    let outerSuccess: boolean; let outerData: unknown; let innerSuccess: boolean; let innerData: unknown; let ambientTenant: string | undefined;
    beforeEach(async () => {
        const outer = serviceToken<object>('outer tenant');
        const inner = serviceToken<{ tenant: string | undefined }>('inner tenant');
        const server = new ArcServer({ services: [
            { token: outer, lifetime: 'scoped', factory: async () => {
                const nested = await server.performQuery('Inner', {}, serviceContext('beta'));
                innerSuccess = nested.isSuccess; innerData = nested.data;
                return {};
            } },
            { token: inner, lifetime: 'scoped', factory: (_resolver, identity) => ({ tenant: identity.tenantId }) }
        ], queries: [
            defineQuery({ name: 'Outer', schema: z.object({}), handlerDependencies: [outer], perform: () => 'done' }),
            defineQuery({ name: 'Inner', schema: z.object({}), handlerDependencies: [inner], perform: async () => {
                ambientTenant = currentContext()?.tenantId;
                return (await currentServices().resolve(inner)).tenant;
            } })
        ] });
        const result = await server.performQuery('Outer', {}, serviceContext('alpha'));
        outerSuccess = result.isSuccess; outerData = result.data;
        await server.dispose();
    });
    it('should reset factory resolution state at the nested boundary', () => {
        outerSuccess.should.equal(true);
        (outerData as string).should.equal('done');
        innerSuccess.should.equal(true);
        (innerData as string).should.equal('beta');
        (ambientTenant as string).should.equal('beta');
    });
});
