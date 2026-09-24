// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, defineQuery } from '../../index.js';

should();

describe('query binding and metadata', () => {
    const server = new ArcServer({ queries: [defineQuery({ name: 'List', namespace: 'Tasks', schema: z.object({ limit: z.number(), label: z.string().default('all') }), perform: ({ limit, label }) => Array.from({ length: limit }, (_, index) => ({ index, label })) })] });
    it('binds GET and QUERY without shared mutable state', async () => {
        const get = await server.handle(new Request('http://localhost/api/tasks/list?LIMIT=3&page=1&pageSize=2'));
        should().equal(get?.status, 200);
        ((await get!.json()).paging).should.deep.equal({ page: 1, size: 2, totalItems: 3, totalPages: 2 });
        const query = await server.handle(new Request('http://localhost/api/tasks/list', { method: 'QUERY', body: JSON.stringify({ arguments: { LIMIT: 3 }, paging: { page: 0, pageSize: 2 } }) }));
        should().equal(query?.headers.get('cache-control'), 'no-store');
        ((await query!.json()).data).should.deep.equal([{ index: 0, label: 'all' }, { index: 1, label: 'all' }]);
    });
    it('sorts returned fields before paging and rejects an unknown field', async () => {
        const sorted = await server.handle(new Request('http://localhost/api/tasks/list?limit=3&page=0&pageSize=1&sortBy=index&sortDirection=descending'));
        ((await sorted!.json()).data).should.deep.equal([{ index: 2, label: 'all' }]);
        const bad = await server.handle(new Request('http://localhost/api/tasks/list?limit=3&sortBy=missing'));
        should().equal(bad?.status, 400);
    });
    it('rejects duplicate folded arguments and invalid directions', async () => {
        for (const url of ['http://localhost/api/tasks/list?limit=1&LIMIT=2', 'http://localhost/api/tasks/list?limit=1&sortBy=index&sortDirection=sideways']) {
            const result = await server.handle(new Request(url));
            should().equal(result?.status, 400);
            ((await result!.json()).validationResults[0].reason).should.equal('malformedRequest');
        }
    });
    it('does not claim array paging for a scalar query', async () => {
        const scalar = new ArcServer({ queries: [defineQuery({ name: 'Count', schema: z.object({}), perform: () => 7 })] });
        const response = await scalar.handle(new Request('http://localhost/api/count?pageSize=2'));
        should().equal(response?.status, 400);
    });
    it('introspects real required schemas and echoes valid correlation', async () => {
        const response = await server.handle(new Request('http://localhost/.cratis/queries'));
        const metadata = await response!.json();
        (metadata[0].argumentsSchema.required).should.deep.equal(['limit']);
        const result = await server.handle(new Request('http://localhost/api/tasks/list?limit=1', { headers: { 'X-Correlation-ID': '00000000-0000-0000-0000-000000000000' } }));
        ((await result!.json()).correlationId).should.equal(result?.headers.get('X-Correlation-ID'));
        should().not.equal(result?.headers.get('X-Correlation-ID'), '00000000-0000-0000-0000-000000000000');
    });
});
