// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_server_with_a_list_query } from '../given/a_server_with_a_list_query.js';

should();

describe('when handling a query with an invalid sort direction', given(a_server_with_a_list_query, context => {
    let response: Response | null;
    let body: { validationResults: { reason: string }[] };

    beforeEach(async () => {
        response = await context.server.handle(new Request('http://localhost/api/tasks/list?limit=1&sortBy=index&sortDirection=sideways'));
        body = await response!.json();
    });
    afterAll(async () => context.server.dispose());

    it('should reject the request', () => response!.status.should.equal(400));
    it('should report a malformed request', () => body.validationResults[0]!.reason.should.equal('malformedRequest'));
}));
