// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../index.js';
import { Item } from '../given/Item.js';
import { ItemName } from '../given/ItemName.js';
import { Items } from '../given/Items.js';

describe('when serving a named model-bound query', () => {
    let response: Response;
    let application: ArcApplication;
    beforeEach(async () => {
        const items = new Items();
        items.add(new ItemName('Found'));
        const builder = ArcApplication.createBuilder({ development: true });
        builder.services.addSingleton(Items, () => items);
        builder.add(Item);
        application = await builder.build();
        response = (await application.server.handle(new Request('http://localhost/api/by-name?NAME=Found')))!;
    });
    afterEach(async () => { await application.dispose(); });
    it('should bind the argument without case sensitivity', async () => {
        const result = await response.json();
        result.data.should.deep.equal({ name: 'Found' });
    });
    it('should name the query after its read model and static method', () => {
        application.server.queries.find(query => query.name === 'byName')!.namespace!.should.equal('Item');
    });
});
