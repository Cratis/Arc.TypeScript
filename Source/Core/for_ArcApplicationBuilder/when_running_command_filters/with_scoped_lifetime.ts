// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, afterEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

describe('when running command filters with scoped lifetime', given(command_filter_fixture, context => {
    let instances: number;
    let application: FetchArcApplication;
    beforeEach(async () => {
        instances = 0;
        class ScopedFilter {
            constructor() { instances++; }
            onExecution(): void { context.calls.push('scoped'); }
        }
        const builder = context.builder;
        builder.services.addScoped(ScopedFilter);
        builder.addAuthorizationCommandFilter(ScopedFilter);
        application = await builder.build();
        await Promise.all([application.server.validateCommand('Filtered', { value: 'denied' }, context.execution),
            application.server.validateCommand('Filtered', { value: 'denied' }, context.execution)]);
    });
    afterEach(async () => { await application.dispose(); });
    it('should resolve a new filter in each operation scope', () => { instances.should.equal(2); });
}));
