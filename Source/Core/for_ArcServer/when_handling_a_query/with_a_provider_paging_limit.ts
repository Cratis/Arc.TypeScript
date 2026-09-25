// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, defineQuery, QueryPagingRequired } from '../../index.js';

should();
describe('when handling a query with a provider paging limit', () => {
    const server = new ArcServer({ queries: [defineQuery({ name: 'Tasks', schema: z.object({}),
        perform: () => { throw new QueryPagingRequired(2, true); } })] });
    let response: Response;
    let result: { validationResults: unknown[] };

    beforeEach(async () => {
        response = (await server.handle(new Request('http://localhost/api/tasks')))!;
        result = await response.json();
    });
    afterAll(async () => server.dispose());

    it('should return a bad request', () => response.status.should.equal(400));
    it('should map the message to the Size rule', () => result.validationResults.should.deep.equal([
        { severity: 3, message: 'The result exceeds the maximum page size of 2; request paging', members: ['Size'], reason: 'rule' }
    ]));
});
