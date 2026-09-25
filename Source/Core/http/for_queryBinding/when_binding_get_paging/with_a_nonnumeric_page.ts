// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { getQuery } from '../../queryBinding.js';

should();

describe('when binding GET paging with a nonnumeric page', () => {
    let options: ReturnType<typeof getQuery>['options'];
    beforeEach(() => {
        ({ options } = getQuery(new URL('http://localhost/api/items?page=no&pageSize=2'), z.object({})));
    });
    it('should default the page to zero', () => options.paging!.page.should.equal(0));
    it('should preserve the page size', () => options.paging!.pageSize.should.equal(2));
});
