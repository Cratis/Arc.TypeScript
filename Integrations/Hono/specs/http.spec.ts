// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { it, should } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import { ArcServer, defineCommand } from '@cratis/arc.server';
import { mountHono } from '../src/index.js';

should();

it('serves command, rejects malformed JSON and passes through foreign routes', async () => {
    const app = new Hono<{ Variables: { accountId: string }; Bindings: { API_TOKEN: string } }>();
    mountHono(app, new ArcServer({ commands: [defineCommand({ name: 'Echo', schema: z.object({ value: z.string() }), handle: ({ value }) => value })] }));
    app.get('/foreign', c => c.text('foreign'));
    ((await (await app.request('/api/echo', { method: 'POST', body: '{' })).json()).validationResults[0].reason).should.equal('malformedRequest');
    ((await (await app.request('/api/echo', { method: 'POST', body: '{"value":"hi"}' })).json()).response).should.equal('hi');
    ((await app.request('/api/echo', { method: 'PUT' })).status).should.equal(405);
    ((await app.request('/foreign')).status).should.equal(200);
});
