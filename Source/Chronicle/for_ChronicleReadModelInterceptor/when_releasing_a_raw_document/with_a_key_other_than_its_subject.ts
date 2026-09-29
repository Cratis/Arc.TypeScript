// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { raw_mongo_documents } from '../../given/raw_mongo_documents.js';

describe('when a raw document is keyed by something other than its stored subject', given(raw_mongo_documents, context => {
    let data: object;
    let released: { id: string };
    beforeEach(async () => {
        context.release.resetHistory();
        context.document = { ...context.document, _id: 'key-1', __subject: 'subject-1' };
        data = (await context.query(await context.mongo.find(context.context, {}))).data as object;
        released = context.release.firstCall.args[1] as { id: string };
    });
    it('should release it for the subject Chronicle stored', () => { released.id.should.equal('subject-1'); });
    it('should serve the released document with its key', () => { data.should.deep.equal([{ _id: 'key-1', name: 'plain' }]); });
}));
