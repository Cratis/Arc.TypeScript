// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';

describe('when a .NET-style claim resolver has no explicit claim type', () => {
    let tenant: string;
    beforeEach(async () => {
        const server = new ArcServer({ nativePrincipal: true, tenancy: { resolverType: 'claim' },
            queries: [defineQuery({ name: 'Tenant', schema: z.object({}), perform: (_input, context) => context.tenantId })] });
        try {
            const response = await server.handle(new Request('http://localhost/api/tenant'), {
                principal: { id: 'user', roles: [], isAuthenticated: true, claims: { tenant_id: 'north' } }
            });
            tenant = (await response!.json()).data;
        } finally { await server.dispose(); }
    });
    it('should read the tenant_id claim', () => { tenant.should.equal('north'); });
});
