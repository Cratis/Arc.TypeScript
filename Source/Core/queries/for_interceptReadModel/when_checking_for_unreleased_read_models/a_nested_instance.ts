// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels } from '../../interceptReadModel.js';
import { Person, raw_documents } from '../given/raw_documents.js';

describe('when a protected instance is nested inside another shape', given(raw_documents, context => {
    let error: Error | undefined;
    beforeEach(() => {
        const interceptor = { ...context.interceptor, isReleased: () => false };
        try { assertNoUnreleasedReadModels({ joined: { people: [new Person()] } }, [interceptor]); }
        catch (reason) { error = reason as Error; }
    });
    it('should fail', () => { error!.message.should.contain('nested instances that were not released are not supported'); });
}));
