// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels } from '../../interceptReadModel.js';
import { markRawReadModelDocument } from '../../rawReadModelDocuments.js';
import { Person, raw_documents } from '../given/raw_documents.js';

describe('when a raw document marked as an intercepted model is a nested buffer', given(raw_documents, context => {
    let error: Error | undefined;
    beforeEach(() => {
        const buffer = markRawReadModelDocument(new Uint8Array([1, 2, 3]),
            { model: Person, tenantId: 'tenant-a', subject: 'subject-1' });
        try { assertNoUnreleasedReadModels({ nested: buffer }, [context.interceptor]); }
        catch (reason) { error = reason as Error; }
    });
    it('should fail', () => { error!.message.should.contain('nested or projected raw documents are not supported'); });
}));
