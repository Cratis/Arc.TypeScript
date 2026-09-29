// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { rawReadModelProvenance } from '@cratis/arc.core';
import { given } from '../../given.js';
import { executionContext } from '../given/a_tenant_collection.js';
import { a_typed_tenant_collection } from '../given/a_typed_tenant_collection.js';

should();
describe('when typed raw documents declare their subject explicitly', given(a_typed_tenant_collection, context => {
    let subject: string | undefined;
    beforeEach(async () => {
        const documents = await context.withSubject(document => document.owner).find(executionContext('tenant-a'), 'alice');
        subject = rawReadModelProvenance(documents[0]!)?.subject;
    });
    it('should mark the explicit subject', () => { subject!.should.equal('alice'); });
}));
