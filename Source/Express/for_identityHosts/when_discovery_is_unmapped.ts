// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer } from '@cratis/arc.core';
import { hosts, socket, startHost } from './given/a_real_identity_host.js';

for (const host of hosts) describe(`when ${host} has no authentication outside Development`, () => {
    let statuses: number[];
    let warnings: unknown[];
    beforeEach(async () => {
        warnings = [];
        const listener = await startHost(host, new ArcServer({ environmentName: 'Production', logger: error => warnings.push(error) }));
        try {
            statuses = await Promise.all(['/.cratis/commands', '/.cratis/queries', '/.cratis/identity-details/schema',
                '/.cratis/users', '/.cratis/tenants', '/openapi.json'].map(async path => (await socket(listener.port, false, path)).status));
        } finally { await listener.close(); }
    });
    it('should let the host return 404 for every discovery path', () => statuses.should.deep.equal(Array(6).fill(404)));
    it('should warn once per host', () => warnings.should.have.lengthOf(1));
});
