// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { describeWithMongo } from '../../../given/a_mongodb_database.js';
import { an_item_for_a_tenant } from '../given/an_item_for_a_tenant.js';

describeWithMongo('when adding items as two different tenants', given(an_item_for_a_tenant, context => {
    beforeAll(async () => {
        context.scenario.withContext({ tenantId: 'acme' });
        (await context.scenario.execute({ name: 'Acme item' })).shouldBeSuccessful();
        context.scenario.withContext({ tenantId: 'globex' });
        (await context.scenario.execute({ name: 'Globex item' })).shouldBeSuccessful();
    });
    afterAll(async () => { await context.dispose(); });

    it('should store the acme item in the acme database only', async () => { (await context.itemsOf('acme')).should.deep.equal(['Acme item']); });
    it('should store the globex item in the globex database only', async () => { (await context.itemsOf('globex')).should.deep.equal(['Globex item']); });
}));
