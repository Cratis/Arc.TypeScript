// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should, it } from 'vitest';
import Fastify from 'fastify';
import { z } from 'zod';
import { ArcServer, defineCommand } from '@cratis/arc.server';
import { mountFastify } from '../src/index.js';

should();

it('does not escape to Fastify error handling when the logger rejects', async () => {
    const secret = 'private handler failure';
    const correlationId = crypto.randomUUID();
    let attempts = 0;
    const app = Fastify();
    mountFastify(app, new ArcServer({
        commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () => { throw Error(secret); } })],
        logger: async () => { attempts++; throw Error('private logger failure'); }
    }));
    try {
        const response = await app.inject({ method: 'POST', url: '/api/save', payload: '{}', headers: { 'X-Correlation-ID': correlationId } });
        (response.statusCode).should.equal(500);
        (attempts).should.equal(1);
        should().equal(response.headers['x-correlation-id'], correlationId);
        should().exist(response.headers['content-type']);
        (response.headers['content-type']!).should.contain('application/json');
        (response.body).should.not.contain(secret);
        (response.body).should.not.contain('private logger failure');
        const result = response.json();
        (result.correlationId).should.equal(correlationId);
        (result.isSuccess).should.equal(false);
        (result.exceptionMessages).should.deep.equal(['An unexpected error occurred']);
        should().equal(result.response, undefined);
        should().equal(result.data, undefined);
    } finally { await app.close(); }
});
