// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, roles, AuthenticationStatus } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@roles('Admin', 'Reader')
@command()
class AllowedCommand { handle(): string { return 'allowed'; } }

describe('when authorizing any role in one declaration', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        const builder = context.create({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: 'user', roles: ['Reader'], isAuthenticated: true } })] });
        builder.add(AllowedCommand);
        const application = await builder.build();
        try {
            result = (await application.server.handle(new Request('http://localhost/api/allowed-command', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
            })))!;
        } finally { await application.dispose(); }
    });
    it('should authorize the reader', () => { result.status.should.equal(200); });
}));
