// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { commandFilterResult } from '../../commands/commandFilterResult.js';
import { unauthorizedCommandResult } from '../../commands/unauthorizedCommandResult.js';
import { validation } from '../../validation/ValidationResult.js';
import { Severity } from '../../validation/Severity.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

describe('when a filtered warning precedes authorization denial', given(command_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: CommandResult;
    beforeEach(async () => {
        context.calls.length = 0;
        class Warning {
            onExecution(command: CommandContext): CommandResult {
                context.calls.push('warning');
                return commandFilterResult(command, { validationResults: [validation('Warning', [], 'rule', Severity.Warning)] });
            }
        }
        class Deny {
            onExecution(command: CommandContext): CommandResult {
                context.calls.push('deny');
                return unauthorizedCommandResult(command, 'Denied after warning');
            }
        }
        const builder = context.builder;
        builder.services.addScoped(Warning).addScoped(Deny);
        builder.addAuthorizationCommandFilter(Warning).addAuthorizationCommandFilter(Deny);
        application = await builder.build();
        result = await application.server.validateCommand('Filtered', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should deny after filtering the warning', () => { result.isAuthorized.should.equal(false); });
    it('should preserve the later denial reason', () => {
        result.authorizationFailureReason.should.equal('Denied after warning');
    });
    it('should continue to the later filter without validating', () => { context.calls.should.deep.equal(['warning', 'deny']); });
}));
