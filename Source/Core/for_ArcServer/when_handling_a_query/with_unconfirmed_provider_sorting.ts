// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { queryPage } from '../../queries/QueryPage.js';

should();
describe('when handling a query with unconfirmed provider sorting', () => {
    it('should reject the requested sort with 400', async () => {
        const server = new ArcServer({ queries: [defineQuery({ name: 'List', schema: z.object({}),
            perform: () => queryPage([{ title: 'a' }], 2) })] });
        try {
            const response = await server.handle(new Request(
                'http://arc.invalid/api/list?page=0&pageSize=1&sortBy=title&sortDirection=ascending'));
            response!.status.should.equal(400);
        } finally { await server.dispose(); }
    });
});
