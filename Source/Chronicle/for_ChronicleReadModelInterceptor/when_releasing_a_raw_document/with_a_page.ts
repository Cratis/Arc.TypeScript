// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { raw_mongo_documents } from '../../given/raw_mongo_documents.js';

describe('when releasing a page of raw MongoDB documents', given(raw_mongo_documents, context => {
    let data: object;
    beforeEach(async () => {
        context.release.resetHistory();
        data = (await context.query(await context.mongo.queryPage(context.context, {}, { paging: { page: 0, pageSize: 10 } }))).data as object;
    });
    it('should serve released items', () => { data.should.deep.equal([{ _id: 'subject-1', name: 'plain' }]); });
}));
