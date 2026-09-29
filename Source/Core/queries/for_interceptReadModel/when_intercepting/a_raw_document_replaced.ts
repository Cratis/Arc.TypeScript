// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { interceptReadModel } from '../../interceptReadModel.js';
import { rawReadModelProvenance } from '../../rawReadModelDocuments.js';
import { raw_documents } from '../given/raw_documents.js';

describe('when a raw-document interceptor returns a new object', given(raw_documents, context => {
    let document: object;
    beforeEach(async () => {
        document = context.document();
        await interceptReadModel(document, [context.interceptor], context.context);
    });
    it('should keep the stored document marked', () => { (rawReadModelProvenance(document) !== undefined).should.equal(true); });
}));
