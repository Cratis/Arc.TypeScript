// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { ArcApplication, ArcServer, AuthenticationStatus } from '@cratis/arc.core';
import { hosts, socket, startHost } from './given/a_real_identity_host.js';

for (const applicationOptions of [true, false]) for (const host of hosts) for (const environmentName of ['Development', 'Production']) {
    describe(`when ${host} disables discovery in ${environmentName} using ${applicationOptions ? 'application' : 'server'} options`, () => {
        let statuses: number[];
        let mapped: boolean[];
        let authenticationCalls: number;
        beforeEach(async () => {
            const authentication = sinon.stub().returns({ status: AuthenticationStatus.Authenticated,
                principal: { id: 'operator', roles: ['Admin'], isAuthenticated: true } });
            const options = { environmentName, introspection: { enabled: false, requireAuthentication: true, roles: 'Admin' },
                authentication: [authentication] };
            const application = applicationOptions ? await ArcApplication.createBuilder({ ...options, configuration: false }).build() : new ArcServer(options);
            const server = application instanceof ArcServer ? application : application.server;
            const paths = ['/.cratis/commands', '/.cratis/queries', '/openapi.json'];
            mapped = paths.map(path => server.endpoints.has(path));
            const listener = await startHost(host, application);
            try {
                statuses = await Promise.all(paths.map(async path => (await socket(listener.port, false, path)).status));
                authenticationCalls = authentication.callCount;
            } finally { await listener.close(); }
        });
        it('should omit the catalogs and OpenAPI from the route table', () => mapped.should.deep.equal([false, false, false]));
        it('should let the host answer 404 even for an authenticated caller', () => statuses.should.deep.equal([404, 404, 404]));
        it('should not invoke discovery authentication for an unmapped route', () => authenticationCalls.should.equal(0));
    });
}
