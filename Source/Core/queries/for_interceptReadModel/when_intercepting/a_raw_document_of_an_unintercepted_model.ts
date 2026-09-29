// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { interceptReadModel } from '../../interceptReadModel.js';
import { raw_documents, Other } from '../given/raw_documents.js';

describe('when intercepting a raw document of a model without an interceptor', given(raw_documents, context => {
    let document: object;
    let result: unknown;
    beforeEach(async () => {
        document = context.document(Other);
        result = await interceptReadModel(document, [context.interceptor], context.context);
    });
    it('should serve it unchanged', () => { result!.should.equal(document); });
}));
