// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { it, should } from 'vitest';
import Fastify from 'fastify';
import { z } from 'zod';
import { ArcServer, defineCommand, defineQuery } from '@cratis/arc.server';
import { mountFastify } from '../src/index.js';

should();

it('executes commands over Fastify inject with malformed and unsupported requests', async () => {
    const app = Fastify();
    mountFastify(app, new ArcServer({
        commands: [defineCommand({ name: 'Echo', schema: z.object({ value: z.string() }), handle: ({ value }) => value })],
        queries: [defineQuery({ name: 'Read', schema: z.object({ value: z.number() }), perform: ({ value }) => value })]
    }));
    try {
        const ok = await app.inject({ method: 'POST', url: '/api/echo', payload: { value: 'hi' } });
        (ok.statusCode).should.equal(200);
        (ok.json().response).should.equal('hi');
        const bad = await app.inject({ method: 'POST', url: '/api/echo', payload: '{', headers: { 'content-type': 'application/json' } });
        (bad.statusCode).should.equal(400);
        (bad.json().validationResults[0].reason).should.equal('malformedRequest');
        ((await app.inject({ method: 'PUT', url: '/api/echo' })).statusCode).should.equal(405);
        ((await app.inject({ method: 'GET', url: '/other' })).statusCode).should.equal(404);
        const query = await app.inject({ method: 'GET', url: '/api/read?value=3' });
        (query.statusCode).should.equal(200);
        (query.json().data).should.equal(3);
    } finally { await app.close(); }
});
