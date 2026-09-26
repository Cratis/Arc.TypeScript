// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, afterEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

describe('when running command filters with discovered scoped filters', given(command_filter_fixture, context => {
    let result: CommandResult;
    let application: FetchArcApplication;
    beforeEach(async () => {
        context.calls.length = 0;
        application = await context.builder.add(context.pipeline, context.authorization).build();
        result = await application.server.executeCommand('Filtered', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should run authorization first', () => {
        context.calls.should.deep.equal(['authorization', 'pipeline', 'validate', 'local']);
    });
    it('should preserve local validation results', () => {
        result.validationResults.map(item => item.message).should.deep.equal(['Local result']);
    });
}));
