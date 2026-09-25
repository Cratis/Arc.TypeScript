// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, afterEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

describe('when running command filters with validate only', given(command_filter_fixture, context => {
    let application: FetchArcApplication;
    beforeEach(async () => {
        context.calls.length = 0;
        application = await context.builder.add(context.authorization, context.pipeline).build();
        await application.server.validateCommand('Filtered', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should run both groups and local validation without calling provide or handle', () => {
        context.calls.should.deep.equal(['authorization', 'pipeline', 'validate', 'local']);
    });
}));
