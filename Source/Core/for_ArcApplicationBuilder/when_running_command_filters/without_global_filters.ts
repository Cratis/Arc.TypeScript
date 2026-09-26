// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, afterEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

describe('when running command filters without global filters', given(command_filter_fixture, context => {
    let result: CommandResult;
    let application: FetchArcApplication;
    beforeEach(async () => {
        context.calls.length = 0;
        application = await context.builder.build();
        result = await application.server.executeCommand('Filtered', { value: 'invalid' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should preserve aggregated per-definition results', () => {
        result.validationResults.map(item => item.message).should.deep.equal(['Invalid value', 'Local result']);
    });
    it('should run both per-definition callbacks', () => {
        context.calls.should.deep.equal(['validate', 'local']);
    });
}));
