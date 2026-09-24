// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_server_with_a_list_query } from '../given/a_server_with_a_list_query.js';

should();

describe('when handling a query with descending sort before paging', given(a_server_with_a_list_query, context => {
    let data: object[];

    beforeEach(async () => {
        const response = await context.server.handle(new Request('http://localhost/api/tasks/list?limit=3&page=0&pageSize=1&sortBy=index&sortDirection=descending'));
        data = (await response!.json()).data;
    });
    afterAll(async () => context.server.dispose());

    it('should return the highest index first', () => data.should.deep.equal([{ index: 2, label: 'all' }]));
}));
