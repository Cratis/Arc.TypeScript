// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { denied, rejected } from '../../commands/Outcome.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import type { CommandResponseValueHandler } from '../../commands/CommandResponseValueHandler.js';
import { validation } from '../../validation/ValidationResult.js';
should();

describe('when a command finishes after cancellation with an unrelated response handler registered', () => {
    for (const [name, outcome] of [
        ['denial', denied('Forbidden')], ['rejection', rejected(validation('Invalid'))], ['empty', undefined]
    ] as const) {
        it(`should preserve the ${name} without starting the unrelated handler`, async () => {
            const controller = new AbortController();
            let resolved = 0;
            const token = serviceToken<CommandResponseValueHandler>('unrelated');
            const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped, factory: () => {
                resolved++;
                return { canHandle: () => false, handle: () => { throw new Error('Unexpected response handler'); } };
            } }], commandResponseValueHandlers: [token], commands: [defineCommand({ name: 'Run', schema: z.object({}),
                handle: async () => { controller.abort(new Error('canceled')); return outcome; } })] });
            try {
                const result = await server.executeCommand('Run', {}, { correlationId: name, allowedSeverity: 2,
                    principal: undefined, tenantId: undefined, signal: controller.signal });
                resolved.should.equal(0);
                result.exceptionMessages.should.deep.equal([]);
                (result.response === undefined).should.equal(true);
                if (name === 'denial') {
                    result.isAuthorized.should.equal(false);
                    result.authorizationFailureReason.should.equal('Forbidden');
                } else if (name === 'rejection') {
                    result.validationResults.map(item => item.message).should.deep.equal(['Invalid']);
                } else result.isSuccess.should.equal(true);
            } finally { await server.dispose(); }
        });
    }
});
