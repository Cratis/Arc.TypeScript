// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { a_discovery_host } from '../given/a_discovery_host.js';

for (const [authorization, status] of [[undefined, 401], ['Reader', 200]] as const) {
    describe(`when discovering endpoints in Production as ${authorization ?? 'anonymous'}`, () => {
        let responses: (Response | null)[];
        let context: a_discovery_host;
        beforeEach(async () => {
            context = new a_discovery_host();
            responses = await context.request({}, authorization ? { Authorization: authorization } : undefined);
        });
        it('should apply authentication to every description endpoint', () => responses.map(response => response?.status).should.deep.equal(Array(6).fill(status)));
        it('should run the configured authentication handler for every request', () => context.authentication.callCount.should.equal(6));
        it('should prevent shared caching of descriptions and denials', () => responses.every(response => response?.headers.get('cache-control') === 'no-store').should.be.true);
    });
}
