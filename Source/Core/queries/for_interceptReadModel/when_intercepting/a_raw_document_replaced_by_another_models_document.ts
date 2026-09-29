// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels, interceptReadModel } from '../../interceptReadModel.js';
import type { ReadModelInterceptor } from '../../ReadModelInterceptor.js';
import { Other, raw_documents } from '../given/raw_documents.js';

describe('when a raw-document interceptor returns another model\'s raw document', given(raw_documents, context => {
    let error: Error | undefined;
    beforeEach(async () => {
        const protectingOther: ReadModelInterceptor = { model: Other, intercept: model => model,
            interceptRawDocument: async document => document };
        context.interceptRawDocument.callsFake(async () => context.document(Other));
        const interceptors = [context.interceptor, protectingOther];
        const passedThrough = new WeakSet<object>();
        const result = await interceptReadModel(context.document(), interceptors, context.context, passedThrough);
        try { assertNoUnreleasedReadModels(result, interceptors, passedThrough); }
        catch (reason) { error = reason as Error; }
    });
    it('should fail', () => { error!.message.should.contain('Raw Other documents must be returned directly'); });
}));
