// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { microsoftIdentityClaims } from '../../microsoftIdentityPlatform.js';
import { a_forwarded_recipe } from '../given/a_forwarded_recipe.js';

describe('when using forwarded identity headers without provider metadata', given(a_forwarded_recipe, context => {
    let claims: Record<string, string>;
    beforeEach(async () => {
        context.setup();
        await context.get('/.cratis/me', context.headers(' '));
        claims = context.provide.firstCall.args[0].claims as Record<string, string>;
    });
    afterEach(async () => { await context.dispose(); });
    it('should not restore a forged provider from the claim list or IDP header', () => {
        Object.hasOwn(claims, microsoftIdentityClaims.provider).should.equal(false);
    });
}));
