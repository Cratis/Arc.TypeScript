// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { structuredQuery } from '../../queryBinding.js';
import { UnreadableQueryBody } from '../../UnreadableQueryBody.js';

should();
for (const [name, value] of [
    ['body', []], ['paging', { paging: 'wrong' }], ['sorting', { sorting: 'wrong' }],
    ['arguments', { arguments: [] }]
] as const) {
    describe(`when binding structured paging with a nonobject ${name}`, () => {
        let failure: unknown;
        beforeEach(() => {
            try { structuredQuery(value, z.object({})); }
            catch (error) { failure = error; }
        });
        it('should report an unreadable body', () => (failure as Error).should.be.instanceOf(UnreadableQueryBody));
    });
}
