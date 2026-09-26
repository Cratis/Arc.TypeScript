// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

describe('when registering command filters with singleton lifetime', given(command_filter_fixture, context => {
    let message: string;
    beforeEach(async () => {
        const builder = context.builder;
        builder.services.addSingleton(context.authorization);
        builder.addAuthorizationCommandFilter(context.authorization);
        try { await builder.build(); }
        catch (error) { message = String(error); }
    });
    it('should reject a singleton filter', () => {
        message.should.contain('must not be singleton');
    });
}));
