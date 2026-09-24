// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_server_with_a_list_query } from '../given/a_server_with_a_list_query.js';

should();

describe('when handling a query with GET paging', given(a_server_with_a_list_query, context => {
    let response: Response | null;
    let body: { paging: object };

    beforeEach(async () => {
        response = await context.server.handle(new Request('http://localhost/api/tasks/list?LIMIT=3&page=1&pageSize=2'));
        body = await response!.json();
    });
    afterAll(async () => context.server.dispose());

    it('should return HTTP 200', () => response!.status.should.equal(200));
    it('should report the page metadata', () => body.paging.should.deep.equal({ page: 1, size: 2, totalItems: 3, totalPages: 2 }));
}));
