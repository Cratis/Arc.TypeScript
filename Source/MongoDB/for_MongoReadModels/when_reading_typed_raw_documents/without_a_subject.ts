// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { capture_error, should_reject_with_error } from '../given/should_reject_with_error.js';
import { executionContext } from '../given/a_tenant_collection.js';
import { a_typed_tenant_collection } from '../given/a_typed_tenant_collection.js';

should();
describe('when a typed raw document has no usable subject', given(a_typed_tenant_collection, context => {
    it('should reject an ObjectId key without subjectFor', async () => {
        context.toArray.callsFake(async () => [context.doc]);
        should_reject_with_error(await capture_error(context.typed.find(executionContext('tenant-a'), 'alice')), 'has no subject');
    });
    it('should reject an empty explicit subject', async () => should_reject_with_error(
        await capture_error(context.withSubject(() => '').find(executionContext('tenant-a'), 'alice')), 'has no subject'));
}));
