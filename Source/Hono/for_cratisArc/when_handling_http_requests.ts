// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import { ArcServer, defineCommand } from '@cratis/arc.core';
import { cratisArc } from '../index.js';

should();

describe('when handling Hono HTTP requests', () => {
    let arc: ArcServer;
    let malformed: Response;
    let valid: Response;
    let unsupported: Response;
    let foreign: Response;

    beforeEach(async () => {
        const app = new Hono<{ Variables: { accountId: string }; Bindings: { API_TOKEN: string } }>();
        arc = new ArcServer({ commands: [defineCommand({ name: 'Echo', schema: z.object({ value: z.string() }), handle: ({ value }) => value })] });
        app.use(cratisArc(arc));
        app.get('/foreign', c => c.text('foreign'));
        malformed = await app.request('/api/echo', { method: 'POST', body: '{' });
        valid = await app.request('/api/echo', { method: 'POST', body: '{"value":"hi"}' });
        unsupported = await app.request('/api/echo', { method: 'PUT' });
        foreign = await app.request('/foreign');
    });

    afterEach(async () => { await arc.dispose(); });

    it('should reject malformed JSON', async () => {
        (await malformed.json()).validationResults[0].reason.should.equal('malformedRequest');
    });
    it('should execute a command', async () => { (await valid.json()).response.should.equal('hi'); });
    it('should reject an unsupported method', () => { unsupported.status.should.equal(405); });
    it('should pass through a foreign route', () => { foreign.status.should.equal(200); });
});
