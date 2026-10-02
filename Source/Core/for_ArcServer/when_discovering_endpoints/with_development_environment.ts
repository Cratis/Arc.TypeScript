// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { a_discovery_host } from '../given/a_discovery_host.js';

describe('when discovering endpoints with a Development environment', () => {
    let responses: (Response | null)[];
    let context: a_discovery_host;
    beforeEach(async () => {
        context = new a_discovery_host();
        responses = await context.request({ environmentName: 'dEvElOpMeNt', authentication: [] });
    });
    it('should serve every discovery endpoint anonymously', () => responses.map(response => response?.status).should.deep.equal([200, 200, 200, 200, 200, 200]));
    it('should not log an exposure warning', () => context.warnings.called.should.be.false);
});
