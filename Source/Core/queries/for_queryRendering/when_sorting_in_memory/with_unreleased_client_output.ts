// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe } from 'vitest';
import type { QueryResult } from '../../QueryResult.js';
import { a_sorted_client_output_server } from '../given/a_sorted_client_output_server.js';

describe.each([
    { path: 'all', raw: false }, { path: 'watch', raw: false },
    { path: 'all', raw: true }, { path: 'watch', raw: true }
])('when sorting $path client output with unreleased raw=$raw read models', ({ path, raw }) => {
    let result: QueryResult;
    let status: number;
    beforeEach(async () => {
        const context = new a_sorted_client_output_server(raw, false);
        try {
            const response = (await context.server.handle(new Request(`http://localhost/api/${path}?sortBy=order`)))!;
            status = response.status;
            result = await response.json() as QueryResult;
        } finally { await context.server.dispose(); }
    });
    it('should apply the release guard before serializing client output', () => {
        status.should.equal(500);
        result.isSuccess.should.equal(false);
        result.hasExceptions.should.equal(true);
        JSON.stringify(result).should.not.contain('private');
    });
});
