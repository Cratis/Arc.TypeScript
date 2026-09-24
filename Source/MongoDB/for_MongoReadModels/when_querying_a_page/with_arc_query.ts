// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import { given } from '../../given.js';
import { a_tenant_collection, executionContext } from '../given/a_tenant_collection.js';

should();
describe('when querying a page with an Arc query', given(a_tenant_collection, context => {
    let result: Awaited<ReturnType<ArcServer['performQuery']>>;
    let unpaged: Awaited<ReturnType<ArcServer['performQuery']>>;
    beforeEach(async () => {
        const server = new ArcServer({ queries: [defineQuery({ name: 'OwnerTasks', schema: z.object({ owner: z.string() }),
            perform: (input, ctx, options) => context.models.queryPage(ctx, input.owner, options) })] });
        result = await server.performQuery('OwnerTasks', { owner: 'alice' }, executionContext('a'), { paging: { page: 1, pageSize: 1 } });
        unpaged = await server.performQuery('OwnerTasks', { owner: 'alice' }, executionContext('a'));
        await server.dispose();
    });
    it('should return items and paging from the actual query input', () => {
        (result.data as object).should.deep.equal([context.doc]);
        result.paging!.should.deep.equal({ page: 1, size: 1, totalItems: 3, totalPages: 3 });
        context.skip.calledWith(1).should.equal(true);
        context.limit.calledWith(1).should.equal(true);
    });
    it('should reject missing paging through the Arc response', () => {
        unpaged.isSuccess.should.equal(false);
        unpaged.exceptionMessages.should.contain('Error: MongoDB queryPage requires options.paging');
    });
}));
