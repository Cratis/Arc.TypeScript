// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createServer, type Server } from 'node:http';
import express from 'express';
import { ArcApplication } from '@cratis/arc.core';
import { Echo } from '../../../Core/for_ArcApplicationBuilder/given/Echo.js';
import { mountExpress } from '../../index.js';

describe('when mounting a model-bound application in Express', () => {
    let listener: Server;
    let application: ArcApplication;
    let response: Response;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(Echo);
        application = await builder.build();
        const app = express();
        mountExpress(app, application);
        listener = createServer(app);
        await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
        const address = listener.address();
        if (!address || typeof address === 'string') throw new Error('No HTTP port');
        response = await fetch(`http://127.0.0.1:${address.port}/api/echo`, { method: 'POST', body: '{"message":"from Express"}' });
    });
    afterEach(async () => {
        await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
        await application.dispose();
    });
    it('should serve the command through the existing Arc pipeline', async () => {
        (await response.json()).response.should.equal('from Express');
    });
});
