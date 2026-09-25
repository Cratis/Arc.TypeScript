// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { SortDirection } from '@cratis/arc.core';
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { MongoReadModels } from '../../MongoReadModels.js';
import { a_tenant_collection, executionContext } from '../given/a_tenant_collection.js';
import type { Task } from '../given/a_tenant_collection.js';

should();
describe('when querying a page with unlisted Arc sorting', given(a_tenant_collection, context => {
    let error: unknown;
    beforeEach(async () => {
        const models = new MongoReadModels<Task, string>({ client: context.client,
            databaseForTenant: tenant => `app_${tenant}`, filterFor: context.filterFor,
            sortableFields: ['title'] }, 'tasks');
        try { await models.queryPage(executionContext('a'), 'alice', { paging: { page: 0, pageSize: 1 },
            sorting: { field: '$where', direction: SortDirection.Ascending } }); }
        catch (failure) { error = failure; }
    });
    it('should reject before querying MongoDB', () => {
        String(error).should.contain('sorting is not allowed');
        context.countDocuments.called.should.equal(false);
    });
}));
