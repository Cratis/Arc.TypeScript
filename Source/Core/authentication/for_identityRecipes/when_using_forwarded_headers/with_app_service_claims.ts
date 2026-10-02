// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { microsoftIdentityClaims } from '../../microsoftIdentityPlatform.js';
import { a_forwarded_recipe } from '../given/a_forwarded_recipe.js';

describe('when using the documented App Service EasyAuth claims envelope', given(a_forwarded_recipe, context => {
    let body: Record<string, unknown>;
    let role: Response;
    beforeEach(async () => {
        context.setup();
        const headers = context.encode({ auth_typ: 'aad', name_typ: microsoftIdentityClaims.name, role_typ: microsoftIdentityClaims.role,
            claims: [{ typ: microsoftIdentityClaims.name, val: 'Alice' }, { typ: microsoftIdentityClaims.role, val: 'Reports.Read' }] });
        body = await (await context.get('/.cratis/me', headers)).json();
        role = await context.get('/api/role-reports', headers);
    });
    afterEach(async () => { await context.dispose(); });
    it('should establish the forwarded principal', () => { body.id!.should.equal('forwarded-alice'); });
    it('should authorize the standard Microsoft role claim', () => { role.status.should.equal(200); });
    it('should not treat auth typ as provider metadata', () => {
        Object.hasOwn(context.provide.firstCall.args[0].claims as object, microsoftIdentityClaims.provider).should.equal(false);
    });
    it('should leave the name empty without the user details extension', () => { body.name!.should.equal(''); });
}));
