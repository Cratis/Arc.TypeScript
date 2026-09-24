// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, currentContext } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';

should();
describe('when handling concurrent queries with distinct tenants', () => {
    let results: unknown[];
    beforeEach(async () => {
        const server = new ArcServer({ queries: [defineQuery({ name: 'Tenant', schema: z.object({}),
            perform: async (_input, context) => { await new Promise(resolve => setTimeout(resolve, context.tenantId === 'a' ? 10 : 0)); return [context.tenantId, currentContext()?.tenantId]; } })] });
        const responses = await Promise.all(['a', 'b'].map(tenant => server.handle(new Request('http://localhost/api/tenant', { headers: { 'x-cratis-tenant-id': tenant } }))));
        results = await Promise.all(responses.map(async response => (await response!.json()).data));
        await server.dispose();
    });
    it('should isolate the context of tenant a', () => results[0]!.should.deep.equal(['a', 'a']));
    it('should isolate the context of tenant b', () => results[1]!.should.deep.equal(['b', 'b']));
});
