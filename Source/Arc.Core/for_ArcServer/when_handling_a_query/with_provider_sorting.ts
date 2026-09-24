// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { queryPage } from '../../queries/QueryPage.js';

should();
describe('when handling a query with provider sorting', () => {
    let accepted: { data: unknown; paging: { totalItems: number } };
    let rejected: number;
    beforeEach(async () => {
        const server = new ArcServer({ queries: [defineQuery({ name: 'List', schema: z.object({}),
            perform: (_input, _context, options) => queryPage([{ title: 'a' }], 2, options.sorting) })] });
        try {
            const response = await server.handle(new Request('http://arc.invalid/api/list?page=0&pageSize=1&sortBy=title&sortDirection=ascending'));
            accepted = await response!.json();
            const mismatch = new ArcServer({ queries: [defineQuery({ name: 'List', schema: z.object({}),
                perform: () => queryPage([{ title: 'a' }], 2) })] });
            try { rejected = (await mismatch.handle(new Request('http://arc.invalid/api/list?page=0&pageSize=1&sortBy=title&sortDirection=ascending')))!.status; }
            finally { await mismatch.dispose(); }
        } finally { await server.dispose(); }
    });
    it('should preserve provider-sorted page and total', () => {
        (accepted.data as unknown[]).should.deep.equal([{ title: 'a' }]);
        accepted.paging.totalItems.should.equal(2);
    });
    it('should reject an unconfirmed sort', () => { rejected.should.equal(400); });
});
