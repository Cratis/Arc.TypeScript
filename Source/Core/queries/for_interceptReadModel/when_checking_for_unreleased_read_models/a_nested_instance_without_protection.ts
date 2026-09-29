// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels } from '../../interceptReadModel.js';
import { Person, raw_documents } from '../given/raw_documents.js';

describe('when an instance is nested inside another shape and no interceptor protects its type', given(raw_documents, context => {
    it('should serve it as before', () =>
        (() => assertNoUnreleasedReadModels({ joined: { people: [new Person()] } }, [context.interceptor])).should.not.throw());
}));
