// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer } from '../../ArcServer.js';
import type { IntrospectionOptions } from '../../introspection/IntrospectionOptions.js';

for (const enabled of [true, false]) for (const introspection of [{ roles: '' }, { roles: ' ' }, { roles: 'Admin,' },
    { roles: 'Admin,,Reader' }, { roles: 'Admin', requireAuthentication: false }] satisfies IntrospectionOptions[]) {
    describe(`when configuring discovery with invalid roles ${JSON.stringify(introspection)} with catalogs enabled ${enabled}`, () => {
        let failure: unknown;
        beforeEach(() => {
            try { new ArcServer({ environmentName: 'Development', introspection: { ...introspection, enabled } }); } catch (error) { failure = error; }
        });
        it('should reject invalid or contradictory role requirements at startup', () => String(failure).should.contain('Cratis:Arc:Introspection:Roles'));
    });
}
