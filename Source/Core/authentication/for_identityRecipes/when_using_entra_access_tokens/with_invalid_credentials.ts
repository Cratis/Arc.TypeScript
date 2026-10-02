// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { JWTPayload } from 'jose';
import { given } from '../../../given.js';
import { an_entra_recipe } from '../given/an_entra_recipe.js';

const invalid: ReadonlyArray<readonly [string, (context: an_entra_recipe) => JWTPayload]> = [
    ['a different tenant issuer', () => ({ iss: 'https://login.microsoftonline.com/55555555-5555-4555-8555-555555555555/v2.0' })],
    ['a different API audience', () => ({ aud: 'api://another-api' })],
    ['an expired token', () => ({ exp: Math.floor(Date.now() / 1000) - 60 })],
    ['an ID token intended for the separate frontend registration', context => ({ aud: context.client, nonce: 'login-nonce', azp: undefined })]
];

for (const [description, claims] of invalid) describe(`when using Entra credentials with ${description}`, given(an_entra_recipe, context => {
    let identity: Response;
    let role: Response;
    beforeEach(async () => {
        await context.setup();
        const headers = { authorization: `Bearer ${await context.token({ roles: ['Reports.Read'], ...claims(context) })}` };
        identity = await context.get('/.cratis/me', headers);
        role = await context.get('/api/role-reports', headers);
    });
    afterEach(async () => { await context.dispose(); });
    it('should reject identity authentication', () => { identity.status.should.equal(401); });
    it('should not execute the role protected query', () => { role.status.should.equal(401); });
    it('should not call identity enrichment to establish a principal', () => { context.provide.called.should.equal(false); });
}));
