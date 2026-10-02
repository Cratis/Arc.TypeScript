// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_discovery_host } from '../given/a_discovery_host.js';

for (const environmentName of ['Development', 'Production']) for (const [role, status] of [[undefined, 401], ['Reader', 403], ['Admin', 200]] as const) {
    describe(`when catalogs are disabled with identity discovery for ${role ?? 'anonymous'} in ${environmentName}`, given(a_discovery_host, context => {
        let responses: (Response | null)[];
        beforeEach(async () => {
            responses = await context.request({ environmentName, introspection: { enabled: false, requireAuthentication: true, roles: 'Admin' } },
                role ? { Authorization: role } : {});
        });
        it('should retain the identity schema and user and tenant access policy', () => responses.slice(2, 5).map(response => response!.status).should.deep.equal([status, status, status]));
        it('should not handle catalog or OpenAPI requests', () => [responses[0], responses[1], responses[5]].should.deep.equal([null, null, null]));
    }));
}
