// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';

should();

describe('when handling a scalar query with paging', () => {
    const server = new ArcServer({ queries: [defineQuery({ name: 'Count', schema: z.object({}), perform: () => 7 })] });
    let response: Response | null;

    beforeEach(async () => {
        response = await server.handle(new Request('http://localhost/api/count?pageSize=2'));
    });
    afterAll(async () => server.dispose());

    it('should reject paging on a scalar value', () => response!.status.should.equal(400));
});
