// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { SortDirection } from '@cratis/arc.core';
import { given } from '../../given.js';
import { an_observation_scope, settle } from '../given/an_observation_scope.js';

describe('when a new SQL row changes a sorted observed page', given(an_observation_scope, context => {
    let pages: { title: string; total: number }[];
    beforeEach(async () => {
        await context.establish();
        pages = [];
        const subscription = context.models.observePage(undefined, { paging: { page: 0, pageSize: 1 },
            sorting: { field: 'title', direction: SortDirection.Ascending } }).subscribe(page =>
            pages.push({ title: page.items[0]!.title, total: page.totalItems }));
        await settle();
        context.fixture.native.run("insert into tasks values ('41112233-4455-6677-8899-aabbccddeeff', '0')");
        context.handle.notifyChanged(context.fixture.table);
        await settle();
        subscription.unsubscribe();
    });
    afterEach(async () => { await context.dispose(); });
    it('should recompute the SQL sort and total', () => {
        pages.should.deep.equal([{ title: 'a', total: 2 }, { title: '0', total: 3 }]);
    });
}));
