// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, afterEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { commandResult } from '../../commands/createCommandResult.js';
import { validation } from '../../validation/ValidationResult.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

describe('when running command filters with pipeline validation', given(command_filter_fixture, context => {
    let result: CommandResult;
    let application: FetchArcApplication;
    beforeEach(async () => {
        context.calls.length = 0;
        class Reject {
            onExecution(command: CommandContext): CommandResult {
                context.calls.push('reject');
                return commandResult(command, { validationResults: [validation('Global rule')] });
            }
        }
        const builder = context.builder;
        builder.services.addScoped(Reject).addScoped(context.authorization).addScoped(context.pipeline);
        builder.addCommandPipelineFilter(Reject).addCommandPipelineFilter(context.pipeline)
            .addAuthorizationCommandFilter(context.authorization);
        application = await builder.build();
        result = await application.server.validateCommand('Filtered', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should return the global validation result', () => {
        result.validationResults.map(item => item.message).should.deep.equal(['Global rule']);
    });
    it('should stop before local validation and execution', () => {
        context.calls.should.deep.equal(['authorization', 'reject']);
    });
}));
