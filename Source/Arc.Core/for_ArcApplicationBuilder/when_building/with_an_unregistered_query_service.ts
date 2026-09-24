// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../index.js';
import { Item } from '../given/Item.js';

describe('when building with an unregistered model-bound query service', () => {
    let failure: unknown;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(Item);
        try { await builder.build(); }
        catch (error) { failure = error; }
    });
    it('should fail before the host starts', () => {
        String(failure).should.contain('Missing service: Items');
    });
});
