// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { defineQuery } from '../../queries/defineQuery.js';

should();

const secret = 'private failure detail';
const scenarios = {
    handler: () => new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () => { throw Error(secret); } })] }),
    validator: () => new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), validate: () => { throw Error(secret); }, handle: () => 'private response' })] }),
    authentication: () => new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () => 'private response' })], authentication: [() => { throw Error(secret); }] }),
    serialization: () => new ArcServer({ queries: [defineQuery({ name: 'Read', schema: z.object({}), perform: () => BigInt(10) })] })
};

type Observation = {
    status: number | undefined;
    logged: unknown[];
    correlationId: string;
    header: string | null | undefined;
    text: string;
    result: Record<string, unknown>;
};

describe('when logging a failure with a throwing or rejecting logger', () => {
    let observations: Observation[];

    beforeEach(async () => {
        observations = [];
        for (const mode of ['throws', 'rejects'] as const) {
            for (const [name, create] of Object.entries(scenarios)) {
                const logged: unknown[] = [];
                const correlationId = crypto.randomUUID();
                const server = create();
                server.options.logger = error => {
                    logged.push(error);
                    if (mode === 'throws') throw Error('logger secret');
                    return Promise.reject(Error('logger secret'));
                };
                try {
                    const request = name === 'serialization'
                        ? new Request('http://arc.invalid/api/read', { headers: { 'X-Correlation-ID': correlationId } })
                        : new Request('http://arc.invalid/api/save', { method: 'POST', body: '{}', headers: { 'X-Correlation-ID': correlationId } });
                    const response = await server.handle(request);
                    const text = await response!.text();
                    observations.push({ status: response?.status, logged, correlationId, header: response?.headers.get('X-Correlation-ID'),
                        text, result: JSON.parse(text) });
                } finally { await server.dispose(); }
            }
        }
    });

    it('should return one failure per scenario', () => observations.map(value => value.status).should.deep.equal(Array(8).fill(500)));
    it('should log once per scenario', () => observations.map(value => value.logged.length).should.deep.equal(Array(8).fill(1)));
    it('should echo the correlation id', () => observations.map(value => value.header === value.correlationId).should.deep.equal(Array(8).fill(true)));
    it('should redact the original failure', () => observations.map(value => !value.text.includes(secret)).should.deep.equal(Array(8).fill(true)));
    it('should redact the logger failure', () => observations.map(value => !value.text.includes('logger secret')).should.deep.equal(Array(8).fill(true)));
    it('should include the correlation id in the envelope', () => observations.map(value => value.result.correlationId === value.correlationId).should.deep.equal(Array(8).fill(true)));
    it('should report unsuccessful results', () => observations.map(value => value.result.isSuccess).should.deep.equal(Array(8).fill(false)));
    it('should report exceptions', () => observations.map(value => value.result.hasExceptions).should.deep.equal(Array(8).fill(true)));
    it('should return only the redacted exception message', () => observations.map(value => value.result.exceptionMessages).should.deep.equal(Array(8).fill(['An unexpected error occurred'])));
    it('should omit the exception stack', () => observations.map(value => value.result.exceptionStackTrace).should.deep.equal(Array(8).fill('')));
    it('should omit command responses', () => observations.map(value => value.result.response).should.deep.equal(Array(8).fill(undefined)));
    it('should omit query data', () => observations.map(value => value.result.data).should.deep.equal(Array(8).fill(undefined)));
    it('should log the original error object', () => observations.map(value => value.logged[0] instanceof Error).should.deep.equal(Array(8).fill(true)));
});
