// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { ArcApplication } from '@cratis/arc.core';
import { Echo } from '../../../Core/for_ArcApplicationBuilder/given/Echo.js';
import { mountHono } from '../../index.js';

describe('when mounting a model-bound application in Hono', () => {
    let listener: ReturnType<typeof serve>;
    let application: ArcApplication;
    let response: Response;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(Echo);
        application = await builder.build();
        const app = new Hono();
        mountHono(app, application);
        listener = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
        await new Promise<void>(resolve => listener.listening ? resolve() : listener.once('listening', resolve));
        const address = listener.address();
        if (!address || typeof address === 'string') throw new Error('No HTTP port');
        response = await fetch(`http://127.0.0.1:${address.port}/api/echo`, { method: 'POST', body: '{"message":"from Hono"}' });
    });
    afterEach(async () => {
        await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
        await application.dispose();
    });
    it('should serve the command over a real HTTP listener', async () => {
        (await response.json()).response.should.equal('from Hono');
    });
});
