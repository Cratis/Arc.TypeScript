// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { getQuery } from '../../queryBinding.js';

should();
describe('when binding GET paging with nonbreaking whitespace', () => {
    let options: ReturnType<typeof getQuery>['options'];
    beforeEach(() => { ({ options } = getQuery(new URL('http://localhost/api/items?page=-1&pageSize=%C2%A02'), z.object({}))); });
    it('should leave the query unpaged', () => (options.paging === undefined).should.be.true);
});
