// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';

should();
describe('when handling a query with repeated GET arrays', () => {
    let data: unknown;
    let ambiguous: number[];
    let unpaged: number;
    beforeEach(async () => {
        const server = new ArcServer({ queries: [defineQuery({ name: 'List', schema: z.object({ ids: z.array(z.number()).nullable().default([]), active: z.boolean().optional().nullable() }), perform: input => [input] })] });
        data = (await (await server.handle(new Request('http://arc.invalid/api/list?ids=2&ids=3&active=false')))!.json()).data;
        ambiguous = await Promise.all(['ids=2&IDS=3', 'active=true&active=false'].map(async parameters =>
            (await server.handle(new Request(`http://arc.invalid/api/list?${parameters}`)))!.status));
        unpaged = (await server.handle(new Request('http://arc.invalid/api/list', { method: 'QUERY', body: JSON.stringify({ paging: { page: 0, pageSize: 0 } }) })))!.status;
        await server.dispose();
    });
    it('should coerce repeated GET array values through nested wrappers', () => data!.should.deep.equal([{ ids: [2, 3], active: false }]));
    it('should reject case-folded and repeated scalar ambiguity', () => ambiguous.should.deep.equal([400, 400]));
    it('should support unpaged QUERY', () => unpaged.should.equal(200));
});
