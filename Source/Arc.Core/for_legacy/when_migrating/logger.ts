// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, should, it } from 'vitest';
import { z } from 'zod';
import { ArcServer, defineCommand, defineQuery } from '../../index.js';

should();

const request = (path: string, correlationId: string) => new Request('http://arc.invalid' + path, {
    method: 'POST', body: '{}', headers: { 'X-Correlation-ID': correlationId }
});

const secret = 'private failure detail';
const scenarios = {
    handler: () => new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () => { throw Error(secret); } })] }),
    validator: () => new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), validate: () => { throw Error(secret); }, handle: () => 'private response' })] }),
    authentication: () => new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () => 'private response' })], authentication: [() => { throw Error(secret); }] }),
    serialization: () => new ArcServer({ queries: [defineQuery({ name: 'Read', schema: z.object({}), perform: () => BigInt(10) })] })
};

describe('logger failures at the HTTP boundary', () => {
    for (const mode of ['throws', 'rejects'] as const) {
        for (const [name, create] of Object.entries(scenarios)) {
            it(`${name} returns one redacted failure when logger ${mode}`, async () => {
                const logged: unknown[] = [];
                const correlationId = crypto.randomUUID();
                const server = create();
                server.options.logger = error => {
                    logged.push(error);
                    if (mode === 'throws') throw Error('logger secret');
                    return Promise.reject(Error('logger secret'));
                };
                const response = await server.handle(name === 'serialization'
                    ? new Request('http://arc.invalid/api/read', { headers: { 'X-Correlation-ID': correlationId } })
                    : request('/api/save', correlationId));
                should().equal(response?.status, 500);
                (logged).should.have.lengthOf(1);
                should().equal(response?.headers.get('X-Correlation-ID'), correlationId);
                const text = await response!.text();
                (text).should.not.contain(secret);
                (text).should.not.contain('logger secret');
                const result = JSON.parse(text);
                (result.correlationId).should.equal(correlationId);
                (result.isSuccess).should.equal(false);
                (result.hasExceptions).should.equal(true);
                (result.exceptionMessages).should.deep.equal(['An unexpected error occurred']);
                (result.exceptionStackTrace).should.equal('');
                should().equal(result.response, undefined);
                should().equal(result.data, undefined);
                should().exist(logged[0]);
                (logged[0] as object).should.be.instanceOf(Error);
            });
        }
    }
    it('retains validatorFailed 400, original error logging once, and redaction when logging succeeds', async () => {
        const logged: unknown[] = [];
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), validate: () => { throw Error(secret); }, handle: () => 'private response' })],
            logger: async error => { logged.push(error); } });
        const response = await server.handle(request('/api/save', crypto.randomUUID()));
        should().equal(response?.status, 400);
        (logged).should.have.lengthOf(1);
        ((logged[0] as Error).message).should.equal(secret);
        const text = await response!.text();
        (text).should.not.contain(secret);
        (JSON.parse(text).validationResults[0].reason).should.equal('validatorFailed');
    });
    it('preserves the original handler error, redacts the body and logs once when logging succeeds', async () => {
        const logged: unknown[] = [];
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () => { throw Error(secret); } })],
            logger: error => { logged.push(error); } });
        const response = await server.handle(request('/api/save', crypto.randomUUID()));
        should().equal(response?.status, 500);
        (logged).should.have.lengthOf(1);
        ((logged[0] as Error).message).should.equal(secret);
        (await response!.text()).should.not.contain(secret);
    });
});
