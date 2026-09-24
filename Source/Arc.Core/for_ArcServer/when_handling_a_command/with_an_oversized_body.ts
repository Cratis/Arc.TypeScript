// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { runtimePost } from '../given/a_runtime_request.js';

should();
describe('when handling a command with an oversized body', () => {
    let status: number;
    let body: { validationResults: { reason: string }[] };
    beforeEach(async () => {
        const server = new ArcServer({ maxBodyBytes: 10, commands: [defineCommand({ name: 'Create', schema: z.object({ value: z.string() }), handle: () => 1 })] });
        const response = (await server.handle(runtimePost('/api/create', { value: 'too long' })))!;
        status = response.status;
        body = await response.json();
        await server.dispose();
    });
    it('should reject the request', () => status.should.equal(400));
    it('should report a malformed request', () => body.validationResults[0]!.reason.should.equal('malformedRequest'));
});
