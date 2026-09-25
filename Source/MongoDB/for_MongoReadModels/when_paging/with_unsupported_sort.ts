// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_tenant_collection, executionContext, type Task } from '../given/a_tenant_collection.js';
import { capture_error, should_reject_with_error } from '../given/should_reject_with_error.js';
import type { MongoPageFindOptions } from '../../MongoPageFindOptions.js';

should();
describe('when paging with unsupported sort', given(a_tenant_collection, context => {
    let failure: unknown;
    let callsBeforeRejection: number;
    beforeEach(async () => {
        context.db.resetHistory();
        context.find.resetHistory();
        await context.models.page(executionContext('a'), 'alice', { page: 0, pageSize: 1 }, { sort: { status: -1 } });
        callsBeforeRejection = context.db.callCount;
        failure = await capture_error(context.models.page(executionContext('a'), 'alice', { page: 0, pageSize: 1 }, { sort: 'status' } as unknown as MongoPageFindOptions<Task>));
    });
    it('should append an id tie-break to supported sorting', () => {
        context.find.firstCall.args[0].should.deep.equal({ owner: 'alice' });
        context.find.firstCall.args[1].sort.should.deep.equal({ status: -1, _id: 1 });
    });
    it('should reject unsupported sort forms before database access', () => {
        should_reject_with_error(failure, 'Paged MongoDB sort');
        context.db.callCount.should.equal(callsBeforeRejection);
    });
}));
