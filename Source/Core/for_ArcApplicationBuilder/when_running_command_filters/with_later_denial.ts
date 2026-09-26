// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { unauthorizedCommandResult } from '../../commands/unauthorizedCommandResult.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

describe('when a later authorization filter denies', given(command_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: CommandResult;
    beforeEach(async () => {
        context.calls.length = 0;
        class Deny {
            onExecution(command: CommandContext): CommandResult { return unauthorizedCommandResult(command, 'Later denial'); }
        }
        const builder = context.builder;
        builder.services.addScoped(Deny);
        builder.addAuthorizationCommandFilter(context.authorization).addAuthorizationCommandFilter(Deny);
        application = await builder.add(context.authorization).build();
        result = await application.server.validateCommand('Filtered', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should deny', () => { result.isAuthorized.should.equal(false); });
    it('should retain the later reason', () => { result.authorizationFailureReason.should.equal('Later denial'); });
    it('should execute the earlier allow only once', () => { context.calls.should.deep.equal(['authorization']); });
}));
