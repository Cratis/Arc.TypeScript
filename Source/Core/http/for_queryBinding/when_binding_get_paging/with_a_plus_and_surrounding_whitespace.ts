// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { getQuery } from '../../queryBinding.js';

should();
describe('when binding GET paging with a plus and surrounding whitespace', () => {
    let options: ReturnType<typeof getQuery>['options'];
    beforeEach(() => { ({ options } = getQuery(new URL('http://localhost/api/items?pageSize=%20%2B2%20'), z.object({}))); });
    it('should parse the size', () => options.paging!.pageSize.should.equal(2));
});
