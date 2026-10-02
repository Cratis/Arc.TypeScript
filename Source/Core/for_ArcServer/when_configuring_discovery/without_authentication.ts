// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer } from '../../ArcServer.js';
import type { IntrospectionOptions } from '../../introspection/IntrospectionOptions.js';

for (const enabled of [true, false]) for (const environmentName of ['Development', 'Production']) for (const introspection of [
    { requireAuthentication: true }, { roles: 'Admin' }
] satisfies IntrospectionOptions[]) {
    describe(`when configuring explicit discovery authentication without handlers in ${environmentName} with catalogs enabled ${enabled}`, () => {
        let failure: unknown;
        beforeEach(() => {
            try { new ArcServer({ environmentName, introspection: { ...introspection, enabled } }); } catch (error) { failure = error; }
        });
        it('should fail startup instead of publishing a protected but unusable route', () => String(failure).should.contain('no Arc authentication handlers or native principal'));
    });
}
