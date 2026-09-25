// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer, defineQuery } from '../../index.js';

describe('when resolving a development tenant without development mode', () => {
    let response: Response;
    beforeEach(async () => {
        const server = new ArcServer({ tenancy: { sources: ['development'], fixedTenantId: 'local' },
            queries: [defineQuery({ name: 'Tenant', schema: z.object({}), perform: (_input, context) => context.tenantId })] });
        try { response = (await server.handle(new Request('http://localhost/api/tenant')))!; }
        finally { await server.dispose(); }
    });
    it('should use the configured fixed tenant', async () => { (await response.json()).data.should.equal('local'); });
});
