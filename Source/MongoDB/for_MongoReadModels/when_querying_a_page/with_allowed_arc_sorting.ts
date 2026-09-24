// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import { z } from 'zod';
import { given } from '../../given.js';
import { MongoReadModels } from '../../MongoReadModels.js';
import { a_tenant_collection, executionContext } from '../given/a_tenant_collection.js';
import type { Task } from '../given/a_tenant_collection.js';

should();
describe('when querying a page with allowed Arc sorting', given(a_tenant_collection, context => {
    let result: Awaited<ReturnType<ArcServer['performQuery']>>;
    beforeEach(async () => {
        const models = new MongoReadModels<Task, string>({ client: context.client,
            databaseForTenant: tenant => `app_${tenant}`, filterFor: context.filterFor,
            sortableFields: ['title'] }, 'tasks');
        const server = new ArcServer({ queries: [defineQuery({ name: 'Tasks', schema: z.object({ owner: z.string() }),
            perform: (input, ctx, options) => models.queryPage(ctx, input.owner, options) })] });
        try { result = await server.performQuery('Tasks', { owner: 'alice' }, executionContext('a'), {
            paging: { page: 1, pageSize: 1 }, sorting: { field: 'title', direction: 'desc' }
        }); } finally { await server.dispose(); }
    });
    it('should count and sort before skipping and limiting', () => {
        result.isSuccess.should.equal(true);
        result.paging!.totalItems.should.equal(3);
        context.find.firstCall.args[1].sort.should.deep.equal({ title: -1, _id: 1 });
        context.skip.calledWith(1).should.equal(true);
        context.limit.calledWith(1).should.equal(true);
    });
}));
