// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import Fastify from 'fastify';
import { z } from 'zod';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import { cratisArc } from '../index.js';
import { given } from '../given.js';

should();
class an_arc_query {
    readonly app = Fastify();
    readonly arc = new ArcServer({ queries: [defineQuery({ name: 'Echo', schema: z.object({}), perform: () => 'ok' })] });
}

describe('when registering the Fastify plugin with a prefix', given(an_arc_query, context => {
    let response: Awaited<ReturnType<typeof context.app.inject>>;
    beforeEach(async () => {
        await context.app.register(cratisArc, { arc: context.arc, prefix: '/v1', webSockets: true });
        response = await context.app.inject({ method: 'GET', url: '/v1/api/echo' });
    });
    afterEach(async () => { await context.app.close(); await context.arc.dispose(); });
    it('should serve the query under the host prefix', () => {
        response.statusCode.should.equal(200);
        response.json().data.should.equal('ok');
    });
}));
