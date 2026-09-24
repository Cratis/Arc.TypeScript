// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { authorize, command, AuthenticationStatus } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@authorize('CanRead')
@command()
class ReadSecret { handle(): string { return 'secret'; } }

const request = () => new Request('http://localhost/api/read-secret', { method: 'POST', body: '{}',
    headers: { 'content-type': 'application/json' } });

describe('when authorizing a model-bound command with a named policy', given(an_application_builder, context => {
    let denied: Response;
    let granted: Response;
    beforeEach(async () => {
        let allow = false;
        const builder = context.create({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: 'alice', roles: [], isAuthenticated: true, claims: { department: 'finance' } } })] });
        builder.add(ReadSecret).addAuthorizationPolicy('CanRead', async principal =>
            allow && (principal.claims as { department: string }).department === 'finance');
        const application = await builder.build();
        try {
            denied = (await application.server.handle(request()))!;
            allow = true;
            granted = (await application.server.handle(request()))!;
        } finally { await application.dispose(); }
    });
    it('should deny a policy that returns false', () => { denied.status.should.equal(403); });
    it('should evaluate the policy before the command handler', async () => {
        granted.status.should.equal(200);
        (await granted.json()).response.should.equal('secret');
    });
}));

describe('when a named authorization policy is missing', given(an_application_builder, context => {
    let error: unknown;
    beforeEach(async () => {
        try { await context.create().add(ReadSecret).build(); }
        catch (failure) { error = failure; }
    });
    it('should fail at build time', () => { String(error).should.contain('Unknown authorization policy'); });
}));
