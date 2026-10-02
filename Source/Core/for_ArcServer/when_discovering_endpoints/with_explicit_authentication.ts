// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { a_discovery_host } from '../given/a_discovery_host.js';

describe('when discovering endpoints with explicit authentication in Development', () => {
    let responses: (Response | null)[];
    beforeEach(async () => {
        responses = await new a_discovery_host().request({ environmentName: 'Development', introspection: { requireAuthentication: true } });
    });
    it('should deny anonymous callers on every endpoint', () => responses.map(response => response?.status).should.deep.equal(Array(6).fill(401)));
});
