// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { SortDirection } from '@cratis/arc.core';
import { given } from '@cratis/arc.testing';
import { a_showcase_catalog } from '../given/a_showcase_catalog.js';

describe('when listing the catalog sorted by name descending, one page of five', given(a_showcase_catalog, context => {
    let result: Awaited<ReturnType<typeof context.all.perform>>;
    beforeEach(async () => {
        result = await context.all.perform({}, { sorting: { field: 'name', direction: SortDirection.Descending },
            paging: { page: 1, pageSize: 5 } });
    });
    afterAll(async () => { await context.all.dispose(); await context.latest.dispose(); });
    it('should return the second page of sorted rows', () => {
        result.data?.map(item => item.name).should.deep.equal(['Item 07', 'Item 06', 'Item 05', 'Item 04', 'Item 03']);
    });
    it('should report the total number of rows', () => { result.paging.totalItems.should.equal(12); });
    it('should report the number of pages', () => { result.paging.totalPages.should.equal(3); });
}));
