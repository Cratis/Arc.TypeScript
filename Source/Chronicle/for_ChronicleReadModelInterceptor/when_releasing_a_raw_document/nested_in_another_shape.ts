// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { raw_mongo_documents } from '../../given/raw_mongo_documents.js';

describe('when raw documents are nested inside another shape', given(raw_mongo_documents, context => {
    let result: Awaited<ReturnType<raw_mongo_documents['query']>>;
    beforeEach(async () => {
        result = await context.query(await context.mongo.page(context.context, {}, { page: 0, pageSize: 10 }));
    });
    it('should fail the query', () => { result.isSuccess.should.equal(false); });
    it('should not serve the stored value', () => { JSON.stringify(result).should.not.contain('ciphertext'); });
}));
