// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels, interceptReadModel } from '../../interceptReadModel.js';
import type { ReadModelInterceptor } from '../../ReadModelInterceptor.js';
import { Other, Person, raw_documents } from '../given/raw_documents.js';

describe('when interception returns an instance of another protected model', given(raw_documents, context => {
    let error: Error | undefined;
    beforeEach(async () => {
        const protectingOther: ReadModelInterceptor = { model: Other, intercept: model => model, isReleased: () => false };
        const returningOther: ReadModelInterceptor = { model: Person, intercept: () => new Other() };
        const interceptors = [protectingOther, returningOther];
        const result = await interceptReadModel(new Person(), interceptors, context.context) as object;
        try { assertNoUnreleasedReadModels(result, interceptors, new WeakSet([result])); }
        catch (reason) { error = reason as Error; }
    });
    it('should fail', () => { error!.message.should.contain('Other read models must be returned directly'); });
}));
