// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ArcServer, defineCommand } from '@cratis/arc.core';
import { mountFastify } from '../index.js';

should();

describe('when the Fastify logger rejects a handler failure', () => {
    let app: FastifyInstance;
    let arc: ArcServer;
    let attempts: number;
    let response: Awaited<ReturnType<FastifyInstance['inject']>>;
    let correlationId: string;
    const secret = 'private handler failure';

    beforeEach(async () => {
        correlationId = crypto.randomUUID();
        attempts = 0;
        app = Fastify();
        arc = new ArcServer({
            commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () => { throw Error(secret); } })],
            logger: async () => { attempts++; throw Error('private logger failure'); }
        });
        mountFastify(app, arc);
        response = await app.inject({ method: 'POST', url: '/api/save', payload: '{}', headers: { 'X-Correlation-ID': correlationId } });
    });

    afterEach(async () => { await app.close(); await arc.dispose(); });

    it('should return an internal error', () => { response.statusCode.should.equal(500); });
    it('should attempt to log the failure once', () => { attempts.should.equal(1); });
    it('should preserve the correlation header', () => { response.headers['x-correlation-id']?.should.equal(correlationId); });
    it('should return JSON', () => { response.headers['content-type']?.should.contain('application/json'); });
    it('should not expose the handler failure', () => { response.body.should.not.contain(secret); });
    it('should not expose the logger failure', () => { response.body.should.not.contain('private logger failure'); });
    it('should preserve the correlation in the response', () => { response.json().correlationId.should.equal(correlationId); });
    it('should report failure', () => { response.json().isSuccess.should.be.false; });
    it('should redact the exception', () => { response.json().exceptionMessages.should.deep.equal(['An unexpected error occurred']); });
    it('should not include a response value', () => { should().equal(response.json().response, undefined); });
    it('should not include query data', () => { should().equal(response.json().data, undefined); });
});
