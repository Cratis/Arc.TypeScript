// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { interceptReadModel } from '../../interceptReadModel.js';
import { raw_documents, Person } from '../given/raw_documents.js';

describe('when intercepting a raw document with an interceptor that cannot transform raw documents', given(raw_documents, context => {
    let error: Error;
    beforeEach(async () => {
        error = await interceptReadModel(context.document(), [{ model: Person, intercept: context.intercept }], context.context)
            .then(() => new Error('not rejected'), (reason: Error) => reason);
    });
    it('should fail rather than serve it untransformed', () => { error.message.should.contain('cannot transform raw documents'); });
}));
