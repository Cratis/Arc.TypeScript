// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ArcServer, defineCommand } from '@cratis/arc.core';
import { cratisArc } from '../index.js';

should();

describe('when parsing foreign application routes', () => {
    let app: FastifyInstance;
    let arc: ArcServer;
    let body: unknown;

    beforeEach(async () => {
        app = Fastify();
        app.post('/foreign', request => ({ parsed: request.body }));
        arc = new ArcServer({ commands: [defineCommand({ name: 'Echo', schema: z.object({}), handle: () => 1 })] });
        app.register(cratisArc, { arc: arc });
        body = (await app.inject({ method: 'POST', url: '/foreign', payload: { value: 1 } })).json();
    });

    afterEach(async () => { await app.close(); await arc.dispose(); });

    it('should retain the parent content parser', () => { (body as object).should.deep.equal({ parsed: { value: 1 } }); });
});
