// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { a_discovery_host } from '../given/a_discovery_host.js';

for (const [authorization, status] of [[undefined, 401], ['Reader', 403], ['Admin', 200], ['Operator', 200]] as const) {
    describe(`when discovering endpoints with required roles as ${authorization ?? 'anonymous'}`, () => {
        let responses: (Response | null)[];
        beforeEach(async () => {
            responses = await new a_discovery_host().request({ environmentName: 'Development',
                introspection: { roles: ' Admin , Operator ' } }, authorization ? { Authorization: authorization } : undefined);
        });
        it('should imply authentication and accept any trimmed role even in Development', () => responses.map(response => response?.status).should.deep.equal(Array(6).fill(status)));
    });
}
