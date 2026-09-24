// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { TaskId } from '../../../TaskId.js';
import { TaskTitle } from '../../../TaskTitle.js';
import { a_task_listing } from '../given/a_task_listing.js';

describe('when collecting the current tasks emission', given(a_task_listing, context => {
    let result: Awaited<ReturnType<typeof context.observable.collect>>;
    beforeEach(async () => {
        context.tasks.register(TaskId.create(), new TaskTitle('Review changes'));
        result = await context.observable.collect(1, 1_000);
    });
    afterAll(async () => { await context.query.dispose(); await context.observable.dispose(); });
    it('should receive the wire-shaped current value', () => {
        result.emissions.should.have.lengthOf(1);
        String(result.emissions[0]?.data?.[0]?.title).should.equal('Review changes');
    });
}));
