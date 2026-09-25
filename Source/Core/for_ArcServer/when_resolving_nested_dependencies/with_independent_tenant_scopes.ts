// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { beforeDeadline, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when resolving nested dependencies with independent tenant scopes', () => {
    let outerTenant: unknown; let nestedTenant: unknown; let calls: string[];
    beforeEach(async () => {
        const tenant = serviceToken<{ id: string | undefined }>('nested tenant token'); calls = [];
        const server = new ArcServer({ services: [{ token: tenant, lifetime: ServiceLifetime.Scoped,
            factory: async (_resolver, identity) => {
            calls.push(identity.tenantId ?? 'none');
            if (identity.tenantId === 'alpha') {
                const nested = await server.performQuery('Tenant', {}, serviceContext('beta'));
                nestedTenant = nested.data;
            }
            return { id: identity.tenantId };
        } }], queries: [defineQuery({ name: 'Tenant', schema: z.object({}), handlerDependencies: [tenant],
            perform: async () => (await currentServices().resolve(tenant)).id })] });
        const result = await beforeDeadline(server.performQuery('Tenant', {}, serviceContext('alpha')), 'independent scoped tenant resolution');
        outerTenant = result.data;
        await beforeDeadline(server.dispose(), 'independent scoped tenant disposal');
    });
    it('should resolve the same token separately in each tenant', () => {
        (outerTenant as string).should.equal('alpha'); (nestedTenant as string).should.equal('beta');
        calls.should.deep.equal(['alpha', 'beta']);
    });
});
