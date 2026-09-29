// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { rawReadModelProvenance } from '@cratis/arc.core';
import type { RawReadModelProvenance } from '@cratis/arc.core';
import { given } from '../../given.js';
import { executionContext } from '../given/a_tenant_collection.js';
import { a_typed_tenant_collection } from '../given/a_typed_tenant_collection.js';

should();
describe('when reading a query page of typed raw documents', given(a_typed_tenant_collection, context => {
    let provenance: RawReadModelProvenance | undefined;
    beforeEach(async () => {
        const page = await context.typed.queryPage(executionContext('tenant-a'), 'alice', { paging: { page: 0, pageSize: 10 } });
        provenance = rawReadModelProvenance(page.items[0]!);
    });
    it('should mark each item', () => { provenance!.subject.should.equal('subject-1'); });
}));
