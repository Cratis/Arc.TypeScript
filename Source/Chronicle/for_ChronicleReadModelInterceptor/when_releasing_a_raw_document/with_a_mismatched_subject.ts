// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { raw_mongo_documents } from '../../given/raw_mongo_documents.js';

describe('when a raw document names a different subject than its key', given(raw_mongo_documents, context => {
    let result: Awaited<ReturnType<raw_mongo_documents['query']>>;
    beforeEach(async () => {
        context.release.resetHistory();
        context.document = { _id: 'subject-1', id: 'subject-2', name: 'ciphertext' };
        result = await context.query(await context.mongo.find(context.context, {}));
    });
    it('should fail the query', () => { result.isSuccess.should.equal(false); });
    it('should not ask Chronicle to release', () => { context.release.called.should.equal(false); });
}));
