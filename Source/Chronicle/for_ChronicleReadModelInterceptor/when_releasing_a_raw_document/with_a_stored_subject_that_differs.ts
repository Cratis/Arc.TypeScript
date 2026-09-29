// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { raw_mongo_documents } from '../../given/raw_mongo_documents.js';

describe('when a raw document was stored under a different subject than subjectFor names', given(raw_mongo_documents, context => {
    let result: Awaited<ReturnType<raw_mongo_documents['query']>>;
    beforeEach(async () => {
        context.release.resetHistory();
        context.document = { ...context.document, __subject: 'subject-2' };
        result = await context.query(await context.withSubject(() => 'subject-1').find(context.context, {}));
    });
    it('should fail the query', () => { result.isSuccess.should.equal(false); });
    it('should not serve the stored value', () => { JSON.stringify(result).should.not.contain('ciphertext'); });
    it('should not ask Chronicle to release', () => { context.release.called.should.equal(false); });
}));

describe('when a raw document was stored under a different subject than it declares', given(raw_mongo_documents, context => {
    let result: Awaited<ReturnType<raw_mongo_documents['query']>>;
    beforeEach(async () => {
        context.release.resetHistory();
        context.document = { ...context.document, id: 'subject-1', __subject: 'subject-2' };
        result = await context.query(await context.mongo.find(context.context, {}));
    });
    it('should fail the query', () => { result.isSuccess.should.equal(false); });
    it('should not serve the stored value', () => { JSON.stringify(result).should.not.contain('ciphertext'); });
    it('should not ask Chronicle to release', () => { context.release.called.should.equal(false); });
}));
