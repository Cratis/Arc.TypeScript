// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

class UnmarkedService {}

describe('when adding an undecorated class', given(an_application_builder, context => {
    let error: unknown;
    beforeEach(() => {
        try { context.builder.add(UnmarkedService); }
        catch (failure) { error = failure; }
    });
    it('should reject the class instead of silently registering nothing', () => {
        (error as Error).message.should.contain('Not an Arc artifact');
    });
}));
