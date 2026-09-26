// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, afterEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

describe('when running command filters with throwing authorization', given(command_filter_fixture, context => {
    let result: CommandResult;
    let application: FetchArcApplication;
    beforeEach(async () => {
        context.calls.length = 0;
        class Throwing {
            onExecution(): void { throw new Error('Authorization unavailable'); }
        }
        const builder = context.builder;
        builder.services.addScoped(Throwing).addScoped(context.pipeline);
        builder.addAuthorizationCommandFilter(Throwing).addCommandPipelineFilter(context.pipeline);
        application = await builder.build();
        result = await application.server.executeCommand('Filtered', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail closed', () => { result.isSuccess.should.equal(false); });
    it('should report an exception', () => { result.hasExceptions.should.equal(true); });
    it('should not invoke ordinary filters or handlers', () => { context.calls.should.have.lengthOf(0); });
}));
