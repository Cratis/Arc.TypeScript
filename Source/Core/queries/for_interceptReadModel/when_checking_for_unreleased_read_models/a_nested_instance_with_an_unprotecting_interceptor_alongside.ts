// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels } from '../../interceptReadModel.js';
import { Person, raw_documents } from '../given/raw_documents.js';

describe('when a released nested instance also has an interceptor that does not protect it', given(raw_documents, context => {
    it('should rely on the protecting interceptor', () => {
        const released = new Person();
        const protecting = { ...context.interceptor, isReleased: (model: object) => model === released };
        (() => assertNoUnreleasedReadModels({ joined: [released] }, [context.interceptor, protecting])).should.not.throw();
    });
}));
