// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ObjectId } from 'mongodb';
import { given } from '../../given.js';
import { a_tenant_collection, executionContext } from '../given/a_tenant_collection.js';
import { capture_error, should_reject_with_error } from '../given/should_reject_with_error.js';

should();
describe('when resolving a tenant without a tenant', given(a_tenant_collection, context => {
    let failures: unknown[];
    beforeEach(async () => {
        failures = await Promise.all([context.models.find(executionContext(), 'alice'), context.models.findById(executionContext(), 'alice', new ObjectId()),
            context.models.page(executionContext(), 'alice', { page: 0, pageSize: 1 }),
            context.models.queryPage(executionContext(), 'alice', { paging: { page: 0, pageSize: 1 } })].map(capture_error));
    });
    it('should reject every read method asynchronously', () => {
        for (const failure of failures) should_reject_with_error(failure, 'A tenant is required');
    });
}));