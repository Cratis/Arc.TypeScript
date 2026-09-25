// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConstraintBuilder } from '@cratis/chronicle/events';
import { UniqueAuthorName } from '../../Registration.js';

describe('when defining the unique author name constraint', () => {
    const builder = new ConstraintBuilder('UniqueAuthorName');
    beforeAll(() => { new UniqueAuthorName().define(builder); });
    it('should constrain the registered author name across event sources', () => {
        builder.capture.uniqueConstraint?.eventDefinitions.should.deep.equal([
            { eventTypeId: 'AuthorRegistered', properties: ['name'] }
        ]);
        String(builder.capture.uniqueConstraint?.message).should.equal('Author name must be unique');
        builder.capture.scope.perEventStreamId.should.equal(false);
    });
});
