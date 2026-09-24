// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../index.js';
import { Items } from '../given/Items.js';
import { RegisterItem } from '../given/RegisterItem.js';

describe('when serving a model-bound command over HTTP', () => {
    let response: Response;
    let items: Items;
    beforeEach(async () => {
        items = new Items();
        const builder = ArcApplication.createBuilder({ development: true });
        builder.services.addSingleton(Items, () => items);
        builder.add(RegisterItem);
        const application = await builder.build();
        response = (await application.server.handle(new Request('http://localhost/api/register-item', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'One' })
        })))!;
        await application.dispose();
    });
    it('should encode a concept response as a primitive', async () => {
        const result = await response.json();
        result.response.should.equal('One');
    });
    it('should materialize the concept before calling the handler', () => {
        items.values[0]!.constructor.name.should.equal('ItemName');
    });
});
