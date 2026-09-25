// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { structuredQuery } from '../../queryBinding.js';

should();
describe('when binding structured paging with a null body', () => {
    let result: ReturnType<typeof structuredQuery>;
    beforeEach(() => { result = structuredQuery(null, z.object({})); });
    it('should leave the query unpaged', () => (result.options.paging === undefined).should.be.true);
    it('should bind empty arguments', () => Object.keys(result.input as object).should.be.empty);
});
