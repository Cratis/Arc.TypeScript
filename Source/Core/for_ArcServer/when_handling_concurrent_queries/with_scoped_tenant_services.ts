// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when handling concurrent queries with scoped tenant services', () => {
    let tenants: unknown[]; let disposals: string[];
    beforeEach(async () => {
        const tenant = serviceToken<{ tenantId: string | undefined }>('per execution tenant'); disposals = [];
        const server = new ArcServer({ services: [{ token: tenant, lifetime: ServiceLifetime.Scoped,
            factory: async (_resolver, identity) => {
            await Promise.resolve();
            return { tenantId: identity.tenantId, [Symbol.dispose]: () => { disposals.push(identity.tenantId ?? 'none'); } };
        } }], queries: [defineQuery({ name: 'Tenant', schema: z.object({}), handlerDependencies: [tenant],
            perform: async () => { await Promise.resolve(); return (await currentServices().resolve(tenant)).tenantId; } })] });
        const [a, b] = await Promise.all([server.performQuery('Tenant', {}, serviceContext('alpha')), server.performQuery('Tenant', {}, serviceContext('beta'))]);
        tenants = [a.data, b.data];
        await server.dispose();
    });
    it('should keep tenant results and scoped disposal separate', () => {
        tenants.should.deep.equal(['alpha', 'beta']);
        disposals.sort().should.deep.equal(['alpha', 'beta']);
    });
});
