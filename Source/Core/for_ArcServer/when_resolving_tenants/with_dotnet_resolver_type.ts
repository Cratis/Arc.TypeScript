// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { TenantResolverType } from '../../tenancy/TenantResolverType.js';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';

describe('when resolving a tenant with the .NET fixed resolver type', () => {
    let tenant: string;
    beforeEach(async () => {
        const server = new ArcServer({ tenancy: { resolverType: TenantResolverType.Fixed, fixedTenantId: 'north' },
            queries: [defineQuery({ name: 'Tenant', schema: z.object({}), perform: (_input, context) => context.tenantId })] });
        try {
            const response = await server.handle(new Request('http://localhost/api/tenant'));
            tenant = (await response!.json()).data;
        } finally { await server.dispose(); }
    });
    it('should select the configured fixed tenant', () => { tenant.should.equal('north'); });
});
