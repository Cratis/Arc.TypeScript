// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

describe('when building the same application builder twice', given(an_application_builder, context => {
    let error: unknown;
    beforeEach(async () => {
        const application = await context.builder.build();
        await application.dispose();
        try { await context.builder.build(); }
        catch (failure) { error = failure; }
    });
    it('should refuse to register the same lifetimes again', () => {
        (error as Error).message.should.contain('only once');
    });
}));
