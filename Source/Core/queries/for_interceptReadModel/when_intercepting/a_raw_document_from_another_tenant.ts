// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { interceptReadModel } from '../../interceptReadModel.js';
import { raw_documents, Person } from '../given/raw_documents.js';

describe('when intercepting a raw document from another tenant', given(raw_documents, context => {
    let error: Error;
    beforeEach(async () => {
        error = await interceptReadModel(context.document(Person, 'tenant-b'), [context.interceptor], context.context)
            .then(() => new Error('not rejected'), (reason: Error) => reason);
    });
    it('should fail', () => { error.message.should.contain('another tenant'); });
    it('should not transform it', () => { context.interceptRawDocument.called.should.equal(false); });
}));
