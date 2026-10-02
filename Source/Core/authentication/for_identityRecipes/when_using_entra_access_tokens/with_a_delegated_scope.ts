// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { an_entra_recipe } from '../given/an_entra_recipe.js';

describe('when using an Entra access token with a delegated scope', given(an_entra_recipe, context => {
    let identity: Record<string, unknown>;
    let role: Response;
    let scope: Response;
    beforeEach(async () => {
        await context.setup();
        const headers = { authorization: `Bearer ${await context.token({ scp: 'openid Reports.Read profile' })}` };
        identity = await (await context.get('/.cratis/me', headers)).json();
        role = await context.get('/api/role-reports', headers);
        scope = await context.get('/api/scope-reports', headers);
    });
    afterEach(async () => { await context.dispose(); });
    it('should authorize the exact scope in the named policy', () => { scope.status.should.equal(200); });
    it('should not authorize a role check with a scope of the same name', () => { role.status.should.equal(403); });
    it('should not expose scopes as identity roles', () => { identity.roles!.should.deep.equal([]); });
}));
