// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ArcServer, defineCommand, defineQuery } from '@cratis/arc.core';
import { cratisArc } from '../index.js';

should();

describe('when handling Fastify HTTP requests', () => {
    let app: FastifyInstance;
    let arc: ArcServer;
    let ok: Awaited<ReturnType<FastifyInstance['inject']>>;
    let bad: typeof ok;
    let unsupported: typeof ok;
    let foreign: typeof ok;
    let query: typeof ok;

    beforeEach(async () => {
        app = Fastify();
        arc = new ArcServer({
            commands: [defineCommand({ name: 'Echo', schema: z.object({ value: z.string() }), handle: ({ value }) => value })],
            queries: [defineQuery({ name: 'Read', schema: z.object({ value: z.number() }), perform: ({ value }) => value })]
        });
        app.register(cratisArc, { arc: arc });
        ok = await app.inject({ method: 'POST', url: '/api/echo', payload: { value: 'hi' } });
        bad = await app.inject({ method: 'POST', url: '/api/echo', payload: '{', headers: { 'content-type': 'application/json' } });
        unsupported = await app.inject({ method: 'PUT', url: '/api/echo' });
        foreign = await app.inject({ method: 'GET', url: '/other' });
        query = await app.inject({ method: 'GET', url: '/api/read?value=3' });
    });

    afterEach(async () => { await app.close(); await arc.dispose(); });

    it('should execute a command', () => { ok.statusCode.should.equal(200); ok.json().response.should.equal('hi'); });
    it('should reject malformed JSON', () => {
        bad.statusCode.should.equal(400);
        bad.json().validationResults[0].reason.should.equal('malformedRequest');
    });
    it('should reject an unsupported method', () => { unsupported.statusCode.should.equal(405); });
    it('should leave foreign routes unmatched', () => { foreign.statusCode.should.equal(404); });
    it('should execute a query', () => { query.statusCode.should.equal(200); query.json().data.should.equal(3); });
});
