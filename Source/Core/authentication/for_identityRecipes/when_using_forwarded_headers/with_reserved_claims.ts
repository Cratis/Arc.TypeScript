// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { microsoftIdentityClaims } from '../../microsoftIdentityPlatform.js';
import { a_forwarded_recipe } from '../given/a_forwarded_recipe.js';

describe('when using forwarded identity headers with forged reserved claims', given(a_forwarded_recipe, context => {
    let identity: Response;
    let body: unknown;
    let role: Response;
    let claims: Record<string, string>;
    beforeEach(async () => {
        context.setup();
        identity = await context.get('/.cratis/me', context.headers());
        body = await identity.json();
        role = await context.get('/api/role-reports', context.headers());
        claims = context.provide.firstCall.args[0].claims as Record<string, string>;
    });
    afterEach(async () => { await context.dispose(); });
    it('should accept the principal forwarded by the trusted ingress', () => { identity.status.should.equal(200); });
    it('should return the forwarded identifier and payload display name', () => {
        body!.should.deep.equal({ id: 'forwarded-alice', name: 'Alice', roles: ['Reader', 'Reports.Read'],
            isAuthenticated: true, isAuthorized: true, details: { greeting: 'Hello Alice' } });
    });
    it('should authorize a forwarded Microsoft role claim', () => { role.status.should.equal(200); });
    it('should overwrite the reserved subject with the forwarded identifier', () => { claims.sub!.should.equal('forwarded-alice'); });
    it('should overwrite the reserved name identifier', () => { claims[microsoftIdentityClaims.nameIdentifier]!.should.equal('forwarded-alice'); });
    it('should overwrite the display name from user details', () => { claims[microsoftIdentityClaims.name]!.should.equal('Alice'); });
    it('should derive provider metadata only from the payload field', () => { claims[microsoftIdentityClaims.provider]!.should.equal('aad'); });
    it('should remove case variants of the reserved provider claim', () => { Object.hasOwn(claims, microsoftIdentityClaims.provider.toUpperCase()).should.equal(false); });
    it('should preserve nonreserved claims with case sensitive names', () => { claims.SUB!.should.equal('case-sensitive-extension'); });
    it('should preserve the durable directory object identifier', () => { claims['http://schemas.microsoft.com/identity/claims/objectidentifier']!.should.equal(context.objectId); });
    it('should preserve the tenant associated with the directory object', () => { claims['http://schemas.microsoft.com/identity/claims/tenantid']!.should.equal(context.tenant); });
}));
