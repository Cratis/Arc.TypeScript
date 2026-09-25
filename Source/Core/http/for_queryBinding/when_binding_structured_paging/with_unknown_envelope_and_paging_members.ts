// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { structuredQuery } from '../../queryBinding.js';

should();
describe('when binding structured paging with unknown envelope and paging members', () => {
    let result: ReturnType<typeof structuredQuery>;
    beforeEach(() => { result = structuredQuery({ extra: 1, paging: { pageSize: 2, extra: 1 } }, z.object({})); });
    it('should preserve the recognized page size', () => result.options.paging!.pageSize.should.equal(2));
    it('should ignore unknown envelope members', () => Object.keys(result.input as object).should.be.empty);
});
