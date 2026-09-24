// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, roles, AuthenticationStatus } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@roles('Admin', 'Reader')
@roles('Auditor')
@command()
class ProtectedCommand { handle(): string { return 'secret'; } }

describe('when authorizing a command with stacked role requirements', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        const builder = context.create({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: 'user', roles: ['Admin'], isAuthenticated: true } })] });
        builder.add(ProtectedCommand);
        const application = await builder.build();
        try {
            result = (await application.server.handle(new Request('http://localhost/api/protected-command', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
            })))!;
        } finally { await application.dispose(); }
    });
    it('should require every declaration rather than dropping the auditor requirement', () => {
        result.status.should.equal(403);
    });
}));
