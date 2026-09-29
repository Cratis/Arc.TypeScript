// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels } from '../../interceptReadModel.js';
import { Person, raw_documents } from '../given/raw_documents.js';

describe('when an instance was returned by interception', given(raw_documents, context => {
    it('should not fail', () => {
        const intercepted = new Person();
        (() => assertNoUnreleasedReadModels([intercepted], [context.interceptor], new WeakSet([intercepted]))).should.not.throw();
    });
}));
