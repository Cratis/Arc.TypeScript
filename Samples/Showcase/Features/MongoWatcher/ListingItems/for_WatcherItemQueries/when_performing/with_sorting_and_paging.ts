// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { SortDirection } from '@cratis/arc.core';
import { given } from '@cratis/arc.testing';
import { describeWithMongo } from '../../../given/a_mongodb_database.js';
import { stored_items } from '../given/stored_items.js';

describeWithMongo('when listing stored items sorted by name, one page of two', given(stored_items, context => {
    let result: Awaited<ReturnType<typeof context.all.perform>>;
    beforeAll(async () => {
        await context.store('Cherry', 'Apple', 'Banana');
        result = await context.all.perform({}, { sorting: { field: 'name', direction: SortDirection.Ascending }, paging: { page: 0, pageSize: 2 } });
    });
    afterAll(async () => { await context.dispose(); });

    it('should sort and page the items', () => { result.data?.map(item => item.name).should.deep.equal(['Apple', 'Banana']); });
    it('should report the total number of stored items', () => { result.paging.totalItems.should.equal(3); });
}));
