// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { queryPage } from '../../queries/QueryPage.js';

should();
describe('when handling a query with already paged results', () => {
    let body: { data: unknown; paging: unknown };
    let inconsistent: unknown;
    let unpaged: number;
    let outside: number;
    beforeEach(async () => {
        const server = new ArcServer({ queries: [defineQuery({ name: 'List', schema: z.object({}), perform: () => queryPage([3, 4], 5) })] });
        body = await (await server.handle(new Request('http://arc.invalid/api/list?page=1&pageSize=2')))!.json();
        try { queryPage([1, 2], 1); } catch (error) { inconsistent = error; }
        unpaged = (await server.handle(new Request('http://arc.invalid/api/list')))!.status;
        outside = (await server.handle(new Request('http://arc.invalid/api/list?page=2&pageSize=2')))!.status;
        await server.dispose();
    });
    it('should preserve the pre-paged items and metadata', () => {
        body.data!.should.deep.equal([3, 4]);
        body.paging!.should.deep.equal({ page: 1, size: 2, totalItems: 5, totalPages: 3 });
    });
    it('should reject inconsistent page metadata', () => (inconsistent instanceof Error).should.equal(true));
    it('should require paging for pre-paged results', () => unpaged.should.equal(400));
    it('should reject a page outside the pre-paged range', () => outside.should.equal(400));
});
