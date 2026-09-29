// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { capture_error, should_reject_with_error } from '../given/should_reject_with_error.js';
import { executionContext } from '../given/a_tenant_collection.js';
import { a_typed_tenant_collection } from '../given/a_typed_tenant_collection.js';

should();
describe('when reading typed raw documents with a projection', given(a_typed_tenant_collection, context => {
    it('should reject a find projection', async () => should_reject_with_error(
        await capture_error(context.typed.find(executionContext('tenant-a'), 'alice', { projection: { title: 1 } })), 'projections are not supported'));
    it('should reject a page projection', async () => should_reject_with_error(
        await capture_error(context.typed.page(executionContext('tenant-a'), 'alice', { page: 0, pageSize: 1 }, { projection: { title: 1 } })),
        'projections are not supported'));
    it('should not query MongoDB', () => { context.find.called.should.equal(false); });
}));
