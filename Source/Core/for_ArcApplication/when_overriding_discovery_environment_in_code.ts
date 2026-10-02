// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../ArcApplication.js';
import { AuthenticationStatus } from '../authentication/AuthenticationStatus.js';
import { defineCommand } from '../commands/defineCommand.js';
import { z } from 'zod';

for (const [environmentName, hostEnvironment, expectedStatus, exposeDetails] of [
    ['Development', 'Production', 200, false], ['Production', 'Development', 401, true]
] as const) {
    describe(`when overriding discovery environment in code to ${environmentName} on a ${hostEnvironment} host`, () => {
        let status: number;
        let messages: string[];
        beforeEach(async () => {
            const application = await ArcApplication.createBuilder({ environmentName, configuration: {
                file: '/nonexistent/appsettings.json', env: { DOTNET_ENVIRONMENT: hostEnvironment }
            }, authentication: [() => ({ status: AuthenticationStatus.Anonymous })],
            commands: [defineCommand({ name: 'Fail', schema: z.object({}), handle: () => { throw new Error('Private failure'); } })]
            }).build();
            try {
                status = (await application.server.handle(new Request('http://localhost/.cratis/commands')))!.status;
                const response = (await application.server.handle(new Request('http://localhost/api/fail', {
                    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
                })))!;
                messages = (await response.json() as { exceptionMessages: string[] }).exceptionMessages;
            } finally { await application.dispose(); }
        });
        it('should let the code-only option override the discovery environment', () => status.should.equal(expectedStatus));
        it('should keep exception exposure tied to the host environment independently', () =>
            messages.should.deep.equal([exposeDetails ? 'Error: Private failure' : 'An unexpected error occurred']));
    });
}
