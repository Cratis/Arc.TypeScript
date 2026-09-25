// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { structuredQuery } from '../../queryBinding.js';

should();
describe('when binding structured sorting with a direction without field', () => {
    let options: ReturnType<typeof structuredQuery>['options'];
    beforeEach(() => { ({ options } = structuredQuery({ sorting: { direction: 'desc' } }, z.object({}))); });
    it('should ignore the direction', () => (options.sorting === undefined).should.be.true);
});
