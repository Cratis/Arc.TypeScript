// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels, interceptReadModel } from '../../interceptReadModel.js';
import { raw_documents } from '../given/raw_documents.js';

describe('when a raw-document interceptor passes the document through', given(raw_documents, context => {
    let document: object;
    let result: unknown;
    beforeEach(async () => {
        document = context.document();
        context.interceptRawDocument.callsFake(async (input: object) => input);
        result = await interceptReadModel(document, [context.interceptor], context.context);
    });
    it('should return the document', () => { (result === document).should.equal(true); });
    it('should serve it as the interceptor returned it', () =>
        (() => assertNoUnreleasedReadModels(result, [context.interceptor])).should.not.throw());
}));
