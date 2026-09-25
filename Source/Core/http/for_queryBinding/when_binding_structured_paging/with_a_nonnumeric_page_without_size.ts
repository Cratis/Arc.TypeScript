// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { structuredQuery } from '../../queryBinding.js';
import { UnreadableQueryBody } from '../../UnreadableQueryBody.js';

should();
describe('when binding structured paging with a nonnumeric page without size', () => {
    let failure: unknown;
    beforeEach(() => {
        try { structuredQuery({ paging: { page: 'no' } }, z.object({})); }
        catch (error) { failure = error; }
    });
    it('should report an unreadable body', () => (failure as Error).should.be.instanceOf(UnreadableQueryBody));
});
