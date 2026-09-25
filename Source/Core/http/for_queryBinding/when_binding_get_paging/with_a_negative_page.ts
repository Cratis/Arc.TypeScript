// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { getQuery, QueryValidationError } from '../../queryBinding.js';

should();

describe('when binding GET paging with a negative page', () => {
    let failure: QueryValidationError;
    beforeEach(() => {
        try { getQuery(new URL('http://localhost/api/items?page=-1&pageSize=2'), z.object({})); }
        catch (error) { failure = error as QueryValidationError; }
    });
    it('should reject with a paging validation error', () => failure.should.be.instanceOf(QueryValidationError));
    it('should report the owning paging rule', () => failure.results.should.deep.equal([
        { severity: 3, message: 'Page number must be greater than or equal to 0', members: ['Page'], reason: 'rule' }
    ]));
});
