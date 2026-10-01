// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { commandResult } from '../../../commands/createCommandResult.js';
import { Severity, validation } from '../../../validation/index.js';
import { classifyOperationOutcome } from '../../classifyOperationOutcome.js';

for (const [authorized, exceptions, reason, aborted, expected] of [
    [false, true, 'constraintViolation', true, 'authorization'],
    [true, true, 'constraintViolation', false, 'error'],
    [true, true, 'constraintViolation', true, 'cancelled'],
    [true, false, 'constraintViolation', true, 'append_rejected'],
    [true, false, 'rule', true, 'validation'],
    [true, false, undefined, true, 'success']
] as const) {
    describe(`when classifying overlapping failures as ${expected}`, () => {
        let outcome: string;
        beforeEach(() => {
            const controller = new AbortController();
            if (aborted) controller.abort();
            const result = commandResult({ correlationId: '', tenantId: undefined, principal: undefined,
                signal: controller.signal, allowedSeverity: Severity.Warning }, {
                isAuthorized: authorized, exceptionMessages: exceptions ? ['private'] : [],
                validationResults: reason ? [validation('private', [], reason)] : []
            });
            outcome = classifyOperationOutcome(result, controller.signal);
        });
        it('should use the same precedence as dotnet', () => { outcome.should.equal(expected); });
    });
}
