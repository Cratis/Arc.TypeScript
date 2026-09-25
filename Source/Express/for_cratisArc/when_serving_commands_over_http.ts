// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { createServer, type Server } from 'node:http';
import express from 'express';
import { z } from 'zod';
import { ArcServer, defineCommand } from '@cratis/arc.core';
import { cratisArc } from '../index.js';

should();

describe('when serving commands over Express HTTP', () => {
    let http: Server;
    let arc: ArcServer;
    let ok: Response;
    let bad: Response;
    let unsupported: Response;
    let foreign: Response;

    beforeEach(async () => {
        const app = express();
        arc = new ArcServer({ commands: [defineCommand({ name: 'Echo', schema: z.object({ value: z.string() }), handle: ({ value }) => value })] });
        app.use(cratisArc(arc));
        app.get('/foreign', (_req, res) => { res.send('foreign'); });
        http = createServer(app);
        await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
        const address = http.address();
        if (!address || typeof address === 'string') throw new Error('No HTTP port');
        const url = `http://127.0.0.1:${address.port}`;
        ok = await fetch(url + '/api/echo', { method: 'POST', body: '{"value":"hi"}' });
        bad = await fetch(url + '/api/echo', { method: 'POST', body: '{' });
        unsupported = await fetch(url + '/api/echo', { method: 'PUT' });
        foreign = await fetch(url + '/foreign');
    });

    afterEach(async () => {
        await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
        await arc.dispose();
    });

    it('should execute a valid command', async () => { (await ok.json()).response.should.equal('hi'); });
    it('should reject malformed JSON', async () => {
        bad.status.should.equal(400);
        (await bad.json()).validationResults[0].reason.should.equal('malformedRequest');
    });
    it('should reject an unsupported method', () => { unsupported.status.should.equal(405); });
    it('should pass through a foreign route', () => { foreign.status.should.equal(200); });
});
