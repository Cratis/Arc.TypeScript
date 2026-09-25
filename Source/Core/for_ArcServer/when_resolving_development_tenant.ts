// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { TenantResolverType } from '../tenancy/TenantResolverType.js';
import { z } from 'zod';
import { ArcServer, defineQuery } from '../index.js';

describe('when resolving a development tenant', () => {
    let selected: Response;
    let users: Response;
    let tenants: Response;
    beforeEach(async () => {
        const server = new ArcServer({ development: true,
            tenancy: { sources: [TenantResolverType.Development], fixedTenantId: 'local' },
            developmentUsers: [() => [{ microsoftIdentity: { identityProvider: 'fixture', userId: 'alice', userDetails: 'Alice',
                userRoles: [], claims: [] } }], () => []],
            developmentTenants: [() => [{ id: 'one', name: 'One' }], () => [{ id: 'two', name: 'Two' }]],
            queries: [defineQuery({ name: 'Tenant', schema: z.object({}), perform: (_input, context) => context.tenantId })] });
        try {
            selected = (await server.handle(new Request('http://localhost/api/tenant')))!;
            users = (await server.handle(new Request('http://localhost/.cratis/users')))!;
            tenants = (await server.handle(new Request('http://localhost/.cratis/tenants')))!;
        } finally { await server.dispose(); }
    });
    it('should use the configured fixed tenant', async () => { (await selected.json()).data.should.equal('local'); });
    it('should aggregate user providers', async () => { (await users.json()).should.have.length(1); });
    it('should aggregate tenant providers', async () => { (await tenants.json()).should.have.length(2); });
});
