// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { QueryPagingRequired } from '@cratis/arc.core';
import { given } from '../../given.js';
import { MongoReadModels } from '../../MongoReadModels.js';
import { a_tenant_collection, executionContext } from '../given/a_tenant_collection.js';

should();
describe('when querying a page without paging above the limit', given(a_tenant_collection, context => {
    let failure: unknown;
    beforeEach(async () => {
        context.countDocuments.resetHistory();
        context.find.resetHistory();
        const models = new MongoReadModels({ client: context.client, databaseForTenant: tenant => `app_${tenant}`,
            filterFor: context.filterFor, maxPageSize: 1 }, 'tasks');
        try { await models.queryPage(executionContext('a'), 'alice', {}); }
        catch (error) { failure = error; }
    });
    it('should signal the paging requirement', () => (failure as Error).should.be.instanceOf(QueryPagingRequired));
    it('should count matching documents', () => context.countDocuments.calledOnce.should.be.true);
    it('should not read any documents', () => context.find.notCalled.should.be.true);
}));
