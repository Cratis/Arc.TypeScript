// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { an_entra_recipe } from '../given/an_entra_recipe.js';

for (const scp of [undefined, 'Reports.Read.All', ['Reports.Read']])
    describe(`when authorizing an Entra token without the exact scope using ${JSON.stringify(scp)}`, given(an_entra_recipe, context => {
        let response: Response;
        beforeEach(async () => {
            await context.setup();
            response = await context.get('/api/scope-reports', { authorization: `Bearer ${await context.token({ scp })}` });
        });
        afterEach(async () => { await context.dispose(); });
        it('should deny the scope policy', () => { response.status.should.equal(403); });
    }));
