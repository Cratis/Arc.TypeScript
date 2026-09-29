// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels, interceptReadModel } from '../../interceptReadModel.js';
import type { ReadModelInterceptor } from '../../ReadModelInterceptor.js';
import { Other, Person, raw_documents } from '../given/raw_documents.js';

describe('when interception returns another protected model\'s raw document', given(raw_documents, context => {
    let error: Error | undefined;
    beforeEach(async () => {
        const protectingOther: ReadModelInterceptor = { model: Other, intercept: model => model,
            interceptRawDocument: async document => document, isReleased: () => true };
        const returningOther: ReadModelInterceptor = { model: Person, intercept: () => context.document(Other) };
        const interceptors = [protectingOther, returningOther];
        const passedThrough = new WeakSet<object>();
        const result = await interceptReadModel(new Person(), interceptors, context.context, passedThrough);
        try { assertNoUnreleasedReadModels(result, interceptors, passedThrough); }
        catch (reason) { error = reason as Error; }
    });
    it('should fail', () => { error!.message.should.contain('Raw Other documents must be returned directly'); });
}));
