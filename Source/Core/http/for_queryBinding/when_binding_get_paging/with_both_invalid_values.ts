// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { getQuery, QueryValidationError } from '../../queryBinding.js';

should();
describe('when binding GET paging with both invalid values', () => {
    let failure: QueryValidationError;
    beforeEach(() => {
        try { getQuery(new URL('http://localhost/api/items?page=-1&pageSize=0'), z.object({})); }
        catch (error) { failure = error as QueryValidationError; }
    });
    it('should report Page before Size', () => failure.results.map(result => result.members[0]).should.deep.equal(['Page', 'Size']));
});
