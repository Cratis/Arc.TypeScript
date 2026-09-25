// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../../ArcServer.js';
import { defineQuery } from '../../defineQuery.js';

should();

describe('when rendering a snapshot with an overflowing page offset', () => {
    const server = new ArcServer({ queries: [defineQuery({ name: 'Items', schema: z.object({}),
        perform: () => [{ id: 1 }, { id: 2 }, { id: 3 }] })] });
    let response: Response;
    let result: { data: unknown[]; paging: { page: number; size: number; totalItems: number } };
    beforeEach(async () => {
        response = (await server.handle(new Request('http://localhost/api/items?page=2147483647&pageSize=2147483647')))!;
        result = await response.json();
    });
    afterAll(() => server.dispose());
    it('should return successfully', () => response.status.should.equal(200));
    it('should return an empty page', () => result.data.should.deep.equal([]));
    it('should retain paging counts', () => result.paging.should.deep.include({ page: 2147483647, size: 2147483647, totalItems: 3 }));
});
