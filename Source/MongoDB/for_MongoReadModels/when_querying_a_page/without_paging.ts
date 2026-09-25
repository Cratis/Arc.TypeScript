// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { SortDirection } from '@cratis/arc.core';
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_tenant_collection, executionContext } from '../given/a_tenant_collection.js';
import { capture_error, should_reject_with_error } from '../given/should_reject_with_error.js';

should();
describe('when querying a page without paging or with Arc sorting', given(a_tenant_collection, context => {
    let missing: unknown;
    let unsupported: unknown;
    beforeEach(async () => {
        [missing, unsupported] = await Promise.all([context.models.queryPage(executionContext('a'), 'alice', {}),
            context.models.queryPage(executionContext('a'), 'alice', { paging: { page: 0, pageSize: 1 },
                sorting: { field: 'title', direction: SortDirection.Ascending } })].map(capture_error));
    });
    it('should require Arc paging', () => should_reject_with_error(missing, 'requires options.paging'));
    it('should reject Arc sorting before database access', () => {
        should_reject_with_error(unsupported, 'sorting is not allowed for field: title');
        context.db.notCalled.should.equal(true);
    });
}));
