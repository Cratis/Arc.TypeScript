// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_tenant_collection, executionContext, type Task } from '../given/a_tenant_collection.js';
import { capture_error, should_reject_with_error } from '../given/should_reject_with_error.js';
import { MongoReadModels } from '../../MongoReadModels.js';

should();
describe('when paging with an invalid size', given(a_tenant_collection, context => {
    let invalid: unknown;
    let oversized: unknown;
    let configured: Awaited<ReturnType<typeof context.models.page>>;
    let rejectedBeforeQuery: boolean;
    beforeEach(async () => {
        context.db.resetHistory();
        [invalid, oversized] = await Promise.all([
            context.models.page(executionContext('a'), 'alice', { page: 0, pageSize: 0 }),
            context.models.page(executionContext('a'), 'alice', { page: 0, pageSize: 101 })].map(capture_error));
        rejectedBeforeQuery = context.db.notCalled;
        const models = new MongoReadModels<Task, string>({ client: context.client, maxPageSize: 200, databaseForTenant: () => 'app', filterFor: owner => ({ owner }) }, 'tasks');
        configured = await models.page(executionContext('a'), 'alice', { page: 0, pageSize: 101 });
    });
    it('should reject invalid page sizes', () => should_reject_with_error(invalid, 'Paging requires'));
    it('should reject sizes exceeding the default limit before querying', () => {
        should_reject_with_error(oversized, 'maxPageSize');
        rejectedBeforeQuery.should.equal(true);
    });
    it('should honor a configured limit', () => configured.items.should.deep.equal([context.doc]));
    it('should reject an invalid configured limit', () => {
        (() => new MongoReadModels<Task, string>({ client: context.client, maxPageSize: 0, databaseForTenant: () => 'app', filterFor: owner => ({ owner }) }, 'tasks')).should.throw('maxPageSize');
    });
}));
