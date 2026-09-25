// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';

describe('when a .NET-style subdomain resolver sees the base host', () => {
    let tenant: string;
    beforeEach(async () => {
        const server = new ArcServer({ tenancy: { resolverType: 'subdomain', baseDomain: 'example.com' },
            queries: [defineQuery({ name: 'Tenant', schema: z.object({}), perform: (_input, context) => context.tenantId })] });
        try {
            const response = await server.handle(new Request('http://localhost/api/tenant', {
                headers: { 'x-cratis-tenant-id': 'north' }
            }), { authority: 'example.com' });
            tenant = (await response!.json()).data;
        } finally { await server.dispose(); }
    });
    it('should fall back to the tenant header', () => { tenant.should.equal('north'); });
});
