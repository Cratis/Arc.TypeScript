// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe } from 'vitest';
import type { QueryResult } from '../../QueryResult.js';
import { a_sorted_client_output_server } from '../given/a_sorted_client_output_server.js';

describe.each([
    { path: 'all', raw: false }, { path: 'watch', raw: false },
    { path: 'all', raw: true }, { path: 'watch', raw: true }
])('when sorting $path client output with raw=$raw read models', ({ path, raw }) => {
    let result: QueryResult;
    let seen: number[];
    beforeEach(async () => {
        const context = new a_sorted_client_output_server(raw, true);
        try {
            const response = (await context.server.handle(new Request(`http://localhost/api/${path}?sortBy=order&pageSize=1`)))!;
            result = await response.json() as QueryResult;
            seen = context.seen;
        } finally { await context.server.dispose(); }
    });
    it('should intercept the original selected row before serializing client output', () => {
        seen.should.deep.equal([1]);
        result.isSuccess.should.equal(true);
        result.data!.should.deep.equal([{ order: 1, name: 'masked' }]);
    });
    it('should preserve paging before interception', () => {
        result.paging.totalItems.should.equal(2);
    });
});
