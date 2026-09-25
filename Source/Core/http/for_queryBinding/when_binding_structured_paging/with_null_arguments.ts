// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { structuredQuery } from '../../queryBinding.js';

should();
describe('when binding structured paging with null arguments', () => {
    let input: unknown;
    beforeEach(() => { ({ input } = structuredQuery({ arguments: null }, z.object({}))); });
    it('should bind empty arguments', () => Object.keys(input as object).should.be.empty);
});
