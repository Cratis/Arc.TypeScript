// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import Fastify, { type FastifyInstance } from 'fastify';
import { ArcApplication } from '@cratis/arc.core';
import { Echo } from '../../../Core/for_ArcApplicationBuilder/given/Echo.js';
import { cratisArc } from '../../index.js';

describe('when mounting a model-bound application in Fastify', () => {
    let server: FastifyInstance;
    let application: ArcApplication;
    let response: Response;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(Echo);
        application = await builder.build();
        server = Fastify();
        server.register(cratisArc, { arc: application });
        const url = await server.listen({ port: 0, host: '127.0.0.1' });
        response = await fetch(url + '/api/echo', { method: 'POST', body: '{"message":"from Fastify"}' });
    });
    afterEach(async () => { await server.close(); await application.dispose(); });
    it('should serve the command over a real HTTP listener', async () => {
        (await response.json()).response.should.equal('from Fastify');
    });
});
