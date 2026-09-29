// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { raw_mongo_documents } from '../../given/raw_mongo_documents.js';

describe('when an observable emits raw documents of a protected read model', given(raw_mongo_documents, context => {
    let data: object;
    beforeEach(async () => {
        context.release.resetHistory();
        data = (await context.observable(await context.mongo.find(context.context, {}))).data as object;
    });
    it('should emit the released documents', () => { data.should.deep.equal([{ _id: 'subject-1', name: 'plain' }]); });
}));
