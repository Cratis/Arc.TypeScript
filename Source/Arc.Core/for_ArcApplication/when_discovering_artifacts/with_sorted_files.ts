// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

describe('when discovering exported artifacts from a dedicated folder', given(an_application_builder, context => {
    let names: string[];
    beforeEach(async () => {
        await context.builder.discover(new URL('../given/discovery/', import.meta.url), { rootNamespace: 'Tasks' });
        const application = await context.builder.build();
        try { names = application.server.commands.map(item => [item.namespace, item.name].join('.')); }
        finally { await application.dispose(); }
    });
    it('should register deterministic file order with the requested namespace', () => {
        names.should.deep.equal(['Tasks.First', 'Tasks.Second']);
    });
}));
