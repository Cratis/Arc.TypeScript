// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../index.js';
import { Item } from '../given/Item.js';
import { Items } from '../given/Items.js';

describe('when serving a model-bound query with an invalid UUID', () => {
    let response: Response;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.services.addSingleton(Items);
        builder.add(Item);
        const application = await builder.build();
        try {
            response = (await application.server.handle(new Request('http://localhost/api/by-guid?id=not-a-uuid')))!;
        } finally { await application.dispose(); }
    });
    it('should reject before calling the query method', async () => {
        response.status.should.equal(400);
        (await response.json()).validationResults[0].reason.should.equal('malformedRequest');
    });
});
