// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { Severity } from '../../validation/Severity.js';

should();
describe('when validating a command with a cancelled validator', () => {
    let result: Awaited<ReturnType<ArcServer['executeCommand']>>;
    beforeEach(async () => {
        const controller = new AbortController();
        controller.abort();
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), validate: () => { throw Error('cancelled'); }, handle: () => 1 })] });
        result = await server.executeCommand('Save', {}, { correlationId: crypto.randomUUID(), tenantId: 'tenant', principal: undefined, allowedSeverity: Severity.Warning, signal: controller.signal });
        await server.dispose();
    });
    it('should not report cancellation as a validation rule', () => result.validationResults.should.deep.equal([]));
    it('should report an exception', () => result.hasExceptions.should.equal(true));
});
