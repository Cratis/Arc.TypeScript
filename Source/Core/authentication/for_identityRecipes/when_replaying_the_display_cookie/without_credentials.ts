// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { an_entra_recipe } from '../given/an_entra_recipe.js';
import { a_forwarded_recipe } from '../given/a_forwarded_recipe.js';

for (const recipe of [an_entra_recipe, a_forwarded_recipe])
    describe(`when replaying only the display cookie from ${recipe.name}`, given<an_entra_recipe | a_forwarded_recipe>(recipe, context => {
        let identity: Response;
        let role: Response;
        let cookie: string;
        beforeEach(async () => {
            await context.setup();
            const headers = context instanceof an_entra_recipe
                ? { authorization: `Bearer ${await context.token({ roles: ['Reports.Read'] })}` }
                : context.headers();
            const authenticated = await context.get('/.cratis/me', headers);
            if (authenticated.status !== 200) throw new Error('The recipe did not issue an authenticated identity');
            cookie = authenticated.headers.get('set-cookie')!.split(';')[0]!;
            context.provide.resetHistory();
            identity = await context.get('/.cratis/me', { cookie });
            role = await context.get('/api/role-reports', { cookie });
        });
        afterEach(async () => { await context.dispose(); });
        it('should exercise an actual display cookie issued by Arc', () => { cookie.should.match(/^\.cratis-identity=.+/); });
        it('should not authenticate identity using the display cookie', () => { identity.status.should.equal(401); });
        it('should not authorize an operation using the display cookie', () => { role.status.should.equal(401); });
        it('should not invoke identity enrichment for an unauthenticated request', () => { context.provide.called.should.equal(false); });
    }));
