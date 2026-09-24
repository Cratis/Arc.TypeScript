// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { it, should } from 'vitest';
import { createServer } from 'node:http';
import express from 'express';
import { z } from 'zod';
import { ArcServer, defineCommand } from '@cratis/arc.core';
import { mountExpress } from '../../index.js';

should();

it('serves Express 5 over a real ephemeral HTTP port', async () => {
    const app = express();
    mountExpress(app, new ArcServer({ commands: [defineCommand({ name: 'Echo', schema: z.object({ value: z.string() }), handle: ({ value }) => value })] }));
    app.get('/foreign', (_req, res) => { res.send('foreign'); });
    const http = createServer(app);
    await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
    try {
        const address = http.address();
        if (!address || typeof address === 'string') throw new Error('No HTTP port');
        const url = `http://127.0.0.1:${address.port}`;
        const ok = await fetch(url + '/api/echo', { method: 'POST', body: '{"value":"hi"}' });
        ((await ok.json()).response).should.equal('hi');
        const bad = await fetch(url + '/api/echo', { method: 'POST', body: '{' });
        (bad.status).should.equal(400);
        ((await bad.json()).validationResults[0].reason).should.equal('malformedRequest');
        ((await fetch(url + '/api/echo', { method: 'PUT' })).status).should.equal(405);
        ((await fetch(url + '/foreign')).status).should.equal(200);
    } finally { await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve())); }
});
