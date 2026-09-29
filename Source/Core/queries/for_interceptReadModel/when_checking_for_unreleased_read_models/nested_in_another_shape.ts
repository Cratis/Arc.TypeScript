// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels } from '../../interceptReadModel.js';
import { raw_documents } from '../given/raw_documents.js';

describe('when an intercepted raw document is nested inside another shape', given(raw_documents, context => {
    let error: Error | undefined;
    beforeEach(() => {
        try { assertNoUnreleasedReadModels({ result: { items: [context.document()] } }, [context.interceptor]); }
        catch (reason) { error = reason as Error; }
    });
    it('should fail', () => { error!.message.should.contain('nested or projected raw documents are not supported'); });
}));
