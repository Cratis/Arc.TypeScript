// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ArcServer, defineCommand } from '@cratis/arc.core';
import { mountFastify } from '../index.js';

should();

describe('when parsing Fastify command bodies', () => {
    let app: FastifyInstance;
    let arc: ArcServer;
    let malformed: Awaited<ReturnType<FastifyInstance['inject']>>[];
    let vendor: typeof malformed[number];
    let unsupported: typeof vendor;

    beforeEach(async () => {
        app = Fastify();
        arc = new ArcServer({ commands: [defineCommand({ name: 'Echo', schema: z.object({ value: z.string() }), handle: input => input.value })] });
        mountFastify(app, arc);
        malformed = [];
        for (const headers of [{ 'content-type': 'application/json' }, { 'content-type': 'application/json', 'content-length': '1' }])
            malformed.push(await app.inject({ method: 'POST', url: '/api/echo', headers, payload: Buffer.from([0xff]) }));
        vendor = await app.inject({ method: 'POST', url: '/api/echo', headers: { 'content-type': 'application/vnd.test+json' }, payload: '{"value":"hi"}' });
        unsupported = await app.inject({ method: 'PATCH', url: '/api/echo', payload: '{}' });
    });

    afterEach(async () => { await app.close(); await arc.dispose(); });

    it('should reject malformed UTF8 with or without content length', () => {
        for (const response of malformed) {
            response.statusCode.should.equal(400);
            response.json().validationResults[0].reason.should.equal('malformedRequest');
        }
    });
    it('should accept vendor JSON', () => {
        vendor.statusCode.should.equal(200);
        vendor.json().response.should.equal('hi');
    });
    it('should report allowed methods for unsupported requests', () => {
        unsupported.statusCode.should.equal(405);
        should().equal(unsupported.headers.allow, 'POST');
    });
});
