// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

describe('when discovery finds both JS and TS outputs', given(an_application_builder, context => {
    let error: unknown;
    beforeEach(async () => {
        try { await context.builder.discover(new URL('../given/mixed/', import.meta.url)); }
        catch (failure) { error = failure; }
    });
    it('should reject the mixed output before importing it', () => {
        (error as Error).message.should.contain('cannot mix emitted JS and TS');
    });
}));
