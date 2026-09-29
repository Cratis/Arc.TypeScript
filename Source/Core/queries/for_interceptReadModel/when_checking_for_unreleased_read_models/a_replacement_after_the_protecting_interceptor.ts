// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels, interceptReadModel } from '../../interceptReadModel.js';
import type { ReadModelInterceptor } from '../../ReadModelInterceptor.js';
import { Person, raw_documents } from '../given/raw_documents.js';

describe('when a later interceptor replaces an instance the protecting interceptor released', given(raw_documents, context => {
    const released = new WeakSet<object>();
    let result: object;
    let error: Error | undefined;
    beforeEach(async () => {
        const protecting: ReadModelInterceptor = { model: Person, isReleased: model => released.has(model),
            intercept: model => { const copy = Object.assign(new Person(), model); released.add(copy); return copy; } };
        const replacing: ReadModelInterceptor = { model: Person,
            intercept: model => Object.assign(new Person(), model, { name: 'masked' }) };
        const interceptors = [protecting, replacing];
        result = await interceptReadModel(new Person(), interceptors, context.context, new WeakSet()) as object;
        try { assertNoUnreleasedReadModels(result, interceptors); }
        catch (reason) { error = reason as Error; }
    });
    it('should release the replacement', () => released.has(result).should.equal(true));
    it('should keep the replacement', () => (result as Person).name.should.equal('masked'));
    it('should serve it', () => (error === undefined).should.equal(true));
}));
