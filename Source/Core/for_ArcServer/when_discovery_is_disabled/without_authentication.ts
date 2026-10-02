// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_discovery_host } from '../given/a_discovery_host.js';

for (const [environmentName, requireAuthentication, warningCount, warning] of [
    ['Development', undefined, 0, ''],
    ['Production', undefined, 1, 'not mapped because authentication is not configured'],
    ['Production', false, 1, 'exposed anonymously outside Development']
] as const) {
    describe(`when disabling catalogs without authentication in ${environmentName} with override ${requireAuthentication}`, given(a_discovery_host, context => {
        beforeEach(async () => {
            context.warnings.resetHistory();
            await context.request({ environmentName, authentication: [], introspection: { enabled: false, requireAuthentication } });
        });
        it('should retain startup warnings for identity discovery', () => context.warnings.callCount.should.equal(warningCount));
        if (warning) it('should describe the remaining discovery exposure', () => String(context.warnings.firstCall.args[0]).should.contain(warning));
    }));
}
