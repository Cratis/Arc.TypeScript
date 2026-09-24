// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ArcServer, defineCommand } from '@cratis/arc.core';
import { mountFastify } from '../index.js';

should();

describe('when routing with a crafted Host header', () => {
    let app: FastifyInstance;
    let arc: ArcServer;
    let command: number;
    let validation: number;
    let deletes: number;

    beforeEach(async () => {
        deletes = 0;
        app = Fastify();
        arc = new ArcServer({ commands: [defineCommand({ name: 'Delete', path: '/api/admin/delete', schema: z.object({}), handle: () => ++deletes })] });
        mountFastify(app, arc);
        command = (await app.inject({ method: 'POST', url: '/api/admin/delete', headers: { host: 'x/api/admin/delete?ignored' }, payload: '{}' })).statusCode;
        validation = (await app.inject({ method: 'POST', url: '/api/admin/delete/validate', headers: { host: 'x/api/admin/delete?ignored' }, payload: '{}' })).statusCode;
    });

    afterEach(async () => { await app.close(); await arc.dispose(); });

    it('should route the matching command', () => { command.should.equal(200); });
    it('should route validation', () => { validation.should.equal(200); });
    it('should execute the command only once', () => { deletes.should.equal(1); });
});
