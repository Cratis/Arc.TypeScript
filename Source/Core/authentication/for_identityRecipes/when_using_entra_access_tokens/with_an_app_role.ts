// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { an_entra_recipe } from '../given/an_entra_recipe.js';

describe('when using an Entra access token with an app role', given(an_entra_recipe, context => {
    let identity: Response;
    let body: unknown;
    let role: Response;
    let scope: Response;
    beforeEach(async () => {
        await context.setup();
        const headers = { authorization: `Bearer ${await context.token({ roles: ['Reports.Read'] })}` };
        identity = await context.get('/.cratis/me', headers);
        body = await identity.json();
        role = await context.get('/api/role-reports', headers);
        scope = await context.get('/api/scope-reports', headers);
    });
    afterEach(async () => { await context.dispose(); });
    it('should accept the signed API access token', () => { identity.status.should.equal(200); });
    it('should return the verified subject and enriched identity', () => {
        body!.should.deep.equal({ id: 'pairwise-alice', name: 'Alice', roles: ['Reports.Read'],
            isAuthenticated: true, isAuthorized: true, details: { greeting: 'Hello Alice' } });
    });
    it('should authorize the matching app role', () => { role.status.should.equal(200); });
    it('should not turn an app role into a delegated scope', () => { scope.status.should.equal(403); });
    it('should fetch only the pinned local JWKS fixture', () => {
        context.keys.fetcher!.calledOnce.should.equal(true);
        String(context.keys.fetcher!.firstCall.args[0]).should.equal(`https://login.microsoftonline.com/${context.tenant}/discovery/v2.0/keys`);
    });
}));
