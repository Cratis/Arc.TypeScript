// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { QueryValidationError, structuredQuery } from '../../queryBinding.js';

should();

describe('when binding structured sorting with an invalid direction', () => {
    let failure: QueryValidationError;
    beforeEach(() => {
        try { structuredQuery({ sorting: { field: 'name', direction: 'sideways' } }, z.object({})); }
        catch (error) { failure = error as QueryValidationError; }
    });
    it('should reject with a validation error', () => failure.should.be.instanceOf(QueryValidationError));
    it('should report the owning sort direction', () => failure.results.should.deep.equal([
        { severity: 3, message: 'The sort direction is not a recognized value.',
            members: ['sorting.direction'], reason: 'malformedRequest' }
    ]));
});
