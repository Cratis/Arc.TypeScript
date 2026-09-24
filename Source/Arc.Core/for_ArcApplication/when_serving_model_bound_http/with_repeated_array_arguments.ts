// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../index.js';
import { Item } from '../given/Item.js';
import { ItemName } from '../given/ItemName.js';
import { Items } from '../given/Items.js';

describe('when serving a model-bound query with repeated GET array arguments', () => {
    let response: Response;
    beforeEach(async () => {
        const items = new Items();
        items.add(new ItemName('one'));
        items.add(new ItemName('two'));
        const builder = ArcApplication.createBuilder();
        builder.services.addSingleton(Items, () => items);
        builder.add(Item);
        const application = await builder.build();
        try {
            response = (await application.server.handle(new Request('http://localhost/api/by-names?names=one&names=missing')))!;
        } finally { await application.dispose(); }
    });
    it('should bind both values and decode each as a concept', async () => {
        (await response.json()).data.should.deep.equal([{ name: 'one' }]);
    });
});
