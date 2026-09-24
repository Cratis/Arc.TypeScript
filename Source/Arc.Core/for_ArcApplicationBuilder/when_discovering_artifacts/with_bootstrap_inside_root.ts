// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fileURLToPath } from 'node:url';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

describe('when the discovery root contains the bootstrap entry', given(an_application_builder, context => {
    let error: unknown;
    beforeEach(async () => {
        const previous = process.argv[1];
        process.argv[1] = fileURLToPath(new URL('../given/discovery/index.js', import.meta.url));
        try { await context.builder.discover(new URL('../given/discovery/', import.meta.url)); }
        catch (failure) { error = failure; }
        finally { if (previous === undefined) process.argv.splice(1, 1); else process.argv[1] = previous; }
    });
    it('should refuse to import its own bootstrap', () => {
        (error as Error).message.should.contain('bootstrap folder');
    });
}));
