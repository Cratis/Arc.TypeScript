// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { interceptReadModel } from '../../interceptReadModel.js';
import { raw_documents } from '../given/raw_documents.js';

describe('when intercepting a raw document marked as an intercepted model', given(raw_documents, context => {
    let result: unknown;
    beforeEach(async () => { result = await interceptReadModel(context.document(), [context.interceptor], context.context); });
    it('should serve the transformed document', () => { result!.should.equal(context.transformed); });
    it('should pass the tenant and subject provenance', () => {
        context.interceptRawDocument.firstCall.args[1].should.include({ tenantId: 'tenant-a', subject: 'subject-1' });
    });
    it('should not use the typed interception', () => { context.intercept.called.should.equal(false); });
}));
