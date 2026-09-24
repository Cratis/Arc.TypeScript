// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { runtimePost } from '../given/a_runtime_request.js';

should();
describe('when handling a command with malformed JSON', () => {
    let unrelated: Response | null;
    let invalid: { status: number; reason: string }[];
    let valid: { status: number; response: number };
    beforeEach(async () => {
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({ value: z.number() }), handle: value => value.value })] });
        unrelated = await server.handle(new Request('http://localhost/elsewhere'));
        invalid = [];
        for (const text of ['{invalid', '{"value":1e309}', '{"value":1,"__proto__":{"polluted":true}}', '{"value":1,"constructor":{}}']) {
            const response = (await server.handle(new Request('http://localhost/api/save', { method: 'POST', body: text })))!;
            const body = await response.json();
            invalid.push({ status: response.status, reason: body.validationResults[0].reason });
        }
        const large = (await server.handle(new Request('http://localhost/api/save', { method: 'POST', body: '{"value":12345}' })))!;
        valid = { status: large.status, response: (await (await server.handle(runtimePost('/api/save', { value: 5, unexpected: 'discarded' })))!.json()).response };
        await server.dispose();
    });
    it('should ignore unrelated routes', () => (unrelated === null).should.equal(true));
    it('should reject malformed and unsafe JSON', () => {
        invalid.should.have.lengthOf(4);
        for (const result of invalid) {
            result.status.should.equal(400);
            result.reason.should.equal('malformedRequest');
        }
    });
    it('should accept safe large numbers', () => valid.status.should.equal(200));
    it('should discard unexpected schema fields', () => valid.response.should.equal(5));
});
