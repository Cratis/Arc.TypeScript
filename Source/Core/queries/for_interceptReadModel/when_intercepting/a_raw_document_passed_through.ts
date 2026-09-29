// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels, interceptReadModel } from '../../interceptReadModel.js';
import { raw_documents } from '../given/raw_documents.js';

describe('when a raw-document interceptor passes the document through', given(raw_documents, context => {
    let document: object;
    let result: unknown;
    let passedThrough: WeakSet<object>;
    beforeEach(async () => {
        document = context.document();
        context.interceptRawDocument.callsFake(async (input: object) => input);
        passedThrough = new WeakSet();
        result = await interceptReadModel(document, [context.interceptor], context.context, passedThrough);
    });
    it('should return the document', () => { (result === document).should.equal(true); });
    it('should serve it in the slot interception returned it for', () =>
        (() => assertNoUnreleasedReadModels(result, [context.interceptor], passedThrough)).should.not.throw());
    it('should keep its mark so it cannot pass as released elsewhere', () =>
        (() => assertNoUnreleasedReadModels({ nested: result }, [context.interceptor])).should.throw('nested or projected raw documents'));
    it('should intercept it again when it is emitted again', async () => {
        const calls = context.interceptRawDocument.callCount;
        await interceptReadModel(document, [context.interceptor], context.context);
        context.interceptRawDocument.callCount.should.equal(calls + 1);
    });
}));
