// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import Fastify from 'fastify';
import { z } from 'zod';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import { cratisArc } from '../index.js';
import { given } from '../given.js';

should();
class a_prefixed_parent {
    readonly app = Fastify();
    readonly arc = new ArcServer({ queries: [defineQuery({ name: 'Echo', schema: z.object({}), perform: () => 'ok' })] });
}
describe('when registering Arc beneath a prefixed parent', given(a_prefixed_parent, context => {
    let response: Awaited<ReturnType<typeof context.app.inject>>;
    beforeEach(async () => {
        await context.app.register(async child => { await child.register(cratisArc, { arc: context.arc }); }, { prefix: '/v1' });
        response = await context.app.inject('/v1/api/echo');
    });
    afterEach(async () => { await context.app.close(); await context.arc.dispose(); });
    it('should serve the query under the parent prefix', () => { response.statusCode.should.equal(200); });
}));
