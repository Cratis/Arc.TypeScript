// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { ArcServer } from '../../ArcServer.js';
import type { ArcOptions } from '../../ArcOptions.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';

export class a_discovery_host {
    readonly paths = ['/.cratis/commands', '/.cratis/queries', '/.cratis/identity-details/schema',
        '/.cratis/users', '/.cratis/tenants', '/openapi.json'];
    readonly warnings = sinon.stub();
    readonly authentication = sinon.stub().callsFake((request: Request) => {
        const role = request.headers.get('Authorization');
        return role ? { status: AuthenticationStatus.Authenticated,
            principal: { id: 'reader', roles: [role], isAuthenticated: true } } : { status: AuthenticationStatus.Anonymous };
    });
    readonly options: ArcOptions = { environmentName: 'Production', logger: this.warnings, authentication: [this.authentication] };
    async request(options: ArcOptions = {}, headers?: HeadersInit): Promise<(Response | null)[]> {
        const server = new ArcServer({ ...this.options, ...options });
        try { return await Promise.all(this.paths.map(path => server.handle(new Request(`http://localhost${path}`, { headers })))); }
        finally { await server.dispose(); }
    }
}
