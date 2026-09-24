// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_server_with_a_list_query } from '../given/a_server_with_a_list_query.js';

should();

describe('when handling a query with an unknown sort field', given(a_server_with_a_list_query, context => {
    let response: Response | null;

    beforeEach(async () => {
        response = await context.server.handle(new Request('http://localhost/api/tasks/list?limit=3&sortBy=missing'));
    });
    afterAll(async () => context.server.dispose());

    it('should reject the request', () => response!.status.should.equal(400));
}));
