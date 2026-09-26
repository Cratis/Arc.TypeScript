// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, afterEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { commandFilterResult } from '../../commands/commandFilterResult.js';
import { validation } from '../../validation/ValidationResult.js';
import { Severity } from '../../validation/Severity.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

describe('when running command filters with a filtered warning', given(command_filter_fixture, context => {
    let application: FetchArcApplication;
    beforeEach(async () => {
        context.calls.length = 0;
        class Warning {
            onExecution(command: CommandContext) {
                context.calls.push('warning');
                return commandFilterResult(command, { validationResults: [validation('Warning', [], 'rule', Severity.Warning)] });
            }
        }
        const builder = context.builder;
        builder.services.addScoped(Warning).addScoped(context.pipeline);
        builder.addAuthorizationCommandFilter(Warning).addCommandPipelineFilter(context.pipeline);
        application = await builder.build();
        await application.server.validateCommand('Filtered', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should continue through authorization and pipeline filters after a filtered warning', () => {
        context.calls.should.deep.equal(['warning', 'pipeline', 'validate', 'local']);
    });
}));
