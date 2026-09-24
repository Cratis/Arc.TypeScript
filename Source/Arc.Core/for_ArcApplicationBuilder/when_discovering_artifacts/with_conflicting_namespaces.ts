// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

describe('when rediscovering artifacts under a different root namespace', given(an_application_builder, context => {
    let error: unknown;
    beforeEach(async () => {
        const folder = new URL('../given/discovery/', import.meta.url);
        await context.builder.discover(folder, { rootNamespace: 'First' });
        try { await context.builder.discover(folder, { rootNamespace: 'Other' }); }
        catch (failure) { error = failure; }
    });
    it('should reject the conflict instead of silently choosing a route', () => {
        (error as Error).message.should.contain('Conflicting namespaces');
    });
}));
