// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { SubscriptionRevisions } from '../SubscriptionRevisions.js';

should();

describe('when validating subscription revisions', () => {
    let invalid: boolean[];
    let valid: boolean;

    beforeEach(() => {
        invalid = [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1', null].map(SubscriptionRevisions.valid);
        valid = SubscriptionRevisions.valid(1);
    });

    it('should reject values that are not positive safe integers', () => { invalid.every(value => !value).should.equal(true); });
    it('should accept positive safe integers', () => { valid.should.equal(true); });
});
