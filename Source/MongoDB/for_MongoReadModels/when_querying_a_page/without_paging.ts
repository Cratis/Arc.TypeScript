// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_tenant_collection, executionContext } from '../given/a_tenant_collection.js';

should();
describe('when querying a page without paging', given(a_tenant_collection, context => {
    let result: Awaited<ReturnType<typeof context.models.queryPage>>;
    beforeEach(async () => {
        result = await context.models.queryPage(executionContext('a'), 'alice', {});
    });
    it('should preserve the total count', () => result.totalItems.should.equal(3));
    it('should start at the first row', () => context.skip.calledWith(0).should.be.true);
    it('should cap the unpaged read', () => context.limit.calledWith(100).should.be.true);
}));
