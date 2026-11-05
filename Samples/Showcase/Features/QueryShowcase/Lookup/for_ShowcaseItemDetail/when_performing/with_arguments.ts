// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_catalog_lookup } from '../given/a_catalog_lookup.js';

describe('when looking up catalog rows with arguments', given(a_catalog_lookup, context => {
    let byId: Awaited<ReturnType<typeof context.byId.perform>>;
    let byCategory: Awaited<ReturnType<typeof context.byCategory.perform>>;
    beforeEach(async () => {
        byId = await context.byId.perform({ id: 3 });
        byCategory = await context.byCategory.perform({ category: 'Games' });
    });
    afterAll(async () => { await context.byId.dispose(); await context.byCategory.dispose(); });
    it('should find the row with the given id', () => { String(byId.data?.name).should.equal('Item 03'); });
    it('should find every row of the given category', () => {
        byCategory.data?.map(item => item.id).should.deep.equal([2, 6, 10]);
    });
}));
