// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { SortDirection } from '@cratis/arc.core';
import { given } from '../../given.js';
import { a_tenant_collection, executionContext } from '../given/a_tenant_collection.js';
import { capture_error, should_reject_with_error } from '../given/should_reject_with_error.js';

should();
describe('when querying a page with unsupported Arc sorting', given(a_tenant_collection, context => {
    let failure: unknown;
    beforeEach(async () => {
        failure = await capture_error(context.models.queryPage(executionContext('a'), 'alice', {
            paging: { page: 0, pageSize: 1 }, sorting: { field: 'title', direction: SortDirection.Ascending }
        }));
    });
    it('should reject the sorting', () => should_reject_with_error(failure, 'sorting is not allowed for field: title'));
    it('should not access the database', () => context.db.notCalled.should.be.true);
}));
