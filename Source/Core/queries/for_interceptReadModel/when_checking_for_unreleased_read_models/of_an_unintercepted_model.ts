// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels } from '../../interceptReadModel.js';
import { raw_documents, Other } from '../given/raw_documents.js';

describe('when a raw document of a model without an interceptor is nested', given(raw_documents, context => {
    it('should accept it', () => {
        (() => assertNoUnreleasedReadModels({ items: [context.document(Other)] }, [context.interceptor])).should.not.throw();
    });
}));
