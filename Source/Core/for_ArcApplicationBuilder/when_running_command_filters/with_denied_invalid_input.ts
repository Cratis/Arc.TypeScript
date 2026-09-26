// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, afterEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
import { Severity } from '../../validation/Severity.js';
should();

describe('when running command filters with denied invalid input', given(command_filter_fixture, context => {
    let result: CommandResult;
    let application: FetchArcApplication;
    beforeEach(async () => {
        context.calls.length = 0;
        const builder = context.builder;
        builder.services.addScoped(context.pipeline).addScoped(context.authorization);
        builder.addCommandPipelineFilter(context.pipeline).addAuthorizationCommandFilter(context.authorization);
        application = await builder.build();
        result = await application.server.validateCommand('Filtered', { value: 'invalid' },
            { ...context.execution, allowedSeverity: Severity.Error });
    });
    afterEach(async () => { await application.dispose(); });
    it('should deny the command', () => { result.isAuthorized.should.equal(false); });
    it('should retain the denial reason', () => { result.authorizationFailureReason.should.equal('Denied by fixture'); });
    it('should not disclose validation results', () => { result.validationResults.should.have.lengthOf(0); });
    it('should run authorization before all other filters regardless of registration order', () => {
        context.calls.should.deep.equal(['authorization']);
    });
}));
