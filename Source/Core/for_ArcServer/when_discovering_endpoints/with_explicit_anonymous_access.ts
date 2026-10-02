// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { a_discovery_host } from '../given/a_discovery_host.js';

describe('when discovering endpoints with explicit anonymous access in Production', () => {
    let responses: (Response | null)[];
    let context: a_discovery_host;
    beforeEach(async () => {
        context = new a_discovery_host();
        responses = await context.request({ authentication: [], introspection: { requireAuthentication: false } });
    });
    it('should serve every discovery endpoint without authentication', () => responses.map(response => response?.status).should.deep.equal(Array(6).fill(200)));
    it('should warn only once per host about anonymous exposure', () => context.warnings.calledOnce.should.be.true);
});
