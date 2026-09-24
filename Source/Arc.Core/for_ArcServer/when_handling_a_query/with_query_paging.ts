// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_server_with_a_list_query } from '../given/a_server_with_a_list_query.js';

should();

describe('when handling a query with QUERY paging', given(a_server_with_a_list_query, context => {
    let response: Response | null;
    let body: { data: object[] };

    beforeEach(async () => {
        response = await context.server.handle(new Request('http://localhost/api/tasks/list', {
            method: 'QUERY', body: JSON.stringify({ arguments: { LIMIT: 3 }, paging: { page: 0, pageSize: 2 } })
        }));
        body = await response!.json();
    });
    afterAll(async () => context.server.dispose());

    it('should disable caching', () => response!.headers.get('cache-control')!.should.equal('no-store'));
    it('should return the first page with default labels', () => body.data.should.deep.equal([{ index: 0, label: 'all' }, { index: 1, label: 'all' }]));
}));
