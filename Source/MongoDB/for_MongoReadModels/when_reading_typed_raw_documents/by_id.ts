// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { rawReadModelProvenance } from '@cratis/arc.core';
import type { RawReadModelProvenance } from '@cratis/arc.core';
import { given } from '../../given.js';
import { executionContext } from '../given/a_tenant_collection.js';
import { a_typed_tenant_collection } from '../given/a_typed_tenant_collection.js';

should();
describe('when finding a typed raw document by id', given(a_typed_tenant_collection, context => {
    let provenance: RawReadModelProvenance | undefined;
    beforeEach(async () => { provenance = rawReadModelProvenance((await context.typed.findById(executionContext('tenant-a'), 'alice', 'subject-1'))!); });
    it('should mark the subject', () => { provenance!.subject.should.equal('subject-1'); });
}));
