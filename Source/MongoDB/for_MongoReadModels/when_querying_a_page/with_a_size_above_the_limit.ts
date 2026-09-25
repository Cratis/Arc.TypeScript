// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import { MongoReadModels } from '../../MongoReadModels.js';
import { given } from '../../given.js';
import { a_tenant_collection, executionContext } from '../given/a_tenant_collection.js';

should();
describe('when querying a page with a size above the limit', given(a_tenant_collection, context => {
    let result: Awaited<ReturnType<ArcServer['performQuery']>>;
    beforeEach(async () => {
        const models = new MongoReadModels({ client: context.client, databaseForTenant: tenant => `app_${tenant}`,
            filterFor: context.filterFor, maxPageSize: 1 }, 'tasks');
        const server = new ArcServer({ queries: [defineQuery({ name: 'OwnerTasks', schema: z.object({ owner: z.string() }),
            perform: (input, ctx, options) => models.queryPage(ctx, input.owner, options) })] });
        try { result = await server.performQuery('OwnerTasks', { owner: 'alice' }, executionContext('a'),
            { paging: { page: 0, pageSize: 2 } }); }
        finally { await server.dispose(); }
    });
    it('should report the size rule', () => result.validationResults.should.deep.equal([
        { severity: 3, message: 'Page size exceeds the maximum page size of 1', members: ['Size'], reason: 'rule' }
    ]));
    it('should not report an exception', () => result.exceptionMessages.should.be.empty);
}));
