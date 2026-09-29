// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels } from '../../interceptReadModel.js';
import { Person, raw_documents } from '../given/raw_documents.js';

describe('when a nested instance is reported released by its interceptor', given(raw_documents, context => {
    it('should not fail', () => {
        const released = new Person();
        const interceptor = { ...context.interceptor, isReleased: (model: object) => model === released };
        (() => assertNoUnreleasedReadModels({ joined: { people: [released] } }, [interceptor])).should.not.throw();
    });
}));
