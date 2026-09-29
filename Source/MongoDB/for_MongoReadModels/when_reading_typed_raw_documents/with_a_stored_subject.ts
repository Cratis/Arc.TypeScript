// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { rawReadModelProvenance } from '@cratis/arc.core';
import type { RawReadModelProvenance } from '@cratis/arc.core';
import { given } from '../../given.js';
import { executionContext } from '../given/a_tenant_collection.js';
import { a_typed_tenant_collection } from '../given/a_typed_tenant_collection.js';

should();
describe('when a typed raw document carries the subject Chronicle stored', given(a_typed_tenant_collection, context => {
    let provenance: RawReadModelProvenance | undefined;
    beforeEach(async () => {
        context.toArray.callsFake(async () => [{ ...context.doc, __subject: 'stored-subject' }]);
        provenance = rawReadModelProvenance((await context.typed.find(executionContext('tenant-a'), 'alice'))[0]!);
    });
    it('should mark the stored subject rather than the key', () => { provenance!.subject.should.equal('stored-subject'); });
}));
