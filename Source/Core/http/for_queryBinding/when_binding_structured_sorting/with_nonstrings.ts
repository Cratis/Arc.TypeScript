// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { structuredQuery } from '../../queryBinding.js';
import { UnreadableQueryBody } from '../../UnreadableQueryBody.js';

should();
for (const [name, sorting] of [
    ['field', { field: 2 }], ['direction', { field: 'name', direction: 2 }],
    ['direction without a field', { direction: 2 }]
] as const) {
    describe(`when binding structured sorting with a nonstring ${name}`, () => {
        let failure: unknown;
        beforeEach(() => {
            try { structuredQuery({ sorting }, z.object({})); }
            catch (error) { failure = error; }
        });
        it('should report an unreadable body', () => (failure as Error).should.be.instanceOf(UnreadableQueryBody));
    });
}
