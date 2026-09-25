// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { a_fetch_application } from './given/a_fetch_application.js';

describe('when requesting file discovery in a Fetch application', given(a_fetch_application, context => {
    let error: unknown;
    beforeEach(async () => {
        try { await context.builder().discover(new URL('file:///missing/')); }
        catch (caught) { error = caught; }
    });
    it('should reject the Node-only operation without opening files', () => {
        (error as Error).message.should.equal('Arc discovery requires the Node application builder');
    });
}));
