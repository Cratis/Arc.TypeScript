// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { raw_mongo_documents } from '../../given/raw_mongo_documents.js';

describe('when releasing raw MongoDB documents of a protected read model', given(raw_mongo_documents, context => {
    let data: object;
    let released: { id: string; name: string };
    beforeEach(async () => {
        context.release.resetHistory();
        data = (await context.query(await context.mongo.find(context.context, {}))).data as object;
        released = context.release.firstCall.args[1] as { id: string; name: string };
    });
    it('should serve the released document with its key', () => { data.should.deep.equal([{ _id: 'subject-1', name: 'plain' }]); });
    it('should release it for the declared subject', () => { released.id.should.equal('subject-1'); });
    it('should pass the stored value to Chronicle', () => { released.name.should.equal('ciphertext'); });
}));
