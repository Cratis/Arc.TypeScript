// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { TaskId } from '../../../TaskId.js';
import { TaskTitle } from '../../../TaskTitle.js';
import { a_task_listing } from '../given/a_task_listing.js';

describe('when performing the tasks query with sorting and paging', given(a_task_listing, context => {
    let result: Awaited<ReturnType<typeof context.query.perform>>;
    beforeAll(() => {
        context.tasks.register(TaskId.create(), new TaskTitle('Zebra'));
        context.tasks.register(TaskId.create(), new TaskTitle('Apple'));
    });
    beforeEach(async () => {
        result = await context.query.perform({}, { sorting: { field: 'title', direction: 'asc' }, paging: { page: 0, pageSize: 1 } });
    });
    afterAll(async () => { await context.query.dispose(); await context.observable.dispose(); });
    it('should return the first sorted wire value', () => {
        result.isSuccess.should.equal(true);
        String(result.data?.[0]?.title).should.equal('Apple');
    });
    it('should report the total number of items', () => { result.paging.totalItems.should.equal(2); });
}));
