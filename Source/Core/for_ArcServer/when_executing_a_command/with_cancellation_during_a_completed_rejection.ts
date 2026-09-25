// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { rejected } from '../../commands/Outcome.js';
import { validation } from '../../validation/ValidationResult.js';
should();

describe('when a rejecting command handler finishes after request cancellation', () => {
    it('should preserve the business rejection instead of replacing it with cancellation', async () => {
        const controller = new AbortController();
        const server = new ArcServer({ commands: [defineCommand({ name: 'Run', schema: z.object({}),
            handle: async () => { controller.abort(new Error('canceled')); return rejected(validation('Denied')); } })] });
        try {
            const result = await server.executeCommand('Run', {}, { correlationId: 'cancel-rejection', allowedSeverity: 2,
                principal: undefined, tenantId: undefined, signal: controller.signal });
            result.isSuccess.should.equal(false);
            result.validationResults.map(item => item.message).should.deep.equal(['Denied']);
            result.exceptionMessages.should.deep.equal([]);
        } finally { await server.dispose(); }
    });
});
