// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { eq } from 'drizzle-orm';
import { given } from '../../given.js';
import { an_observation_scope, settle } from '../given/an_observation_scope.js';
import { TaskRecord } from '../given/TaskRecord.js';

describe('when an observed row is deleted and recreated', given(an_observation_scope, context => {
    let seen: (string | null)[];
    beforeEach(async () => {
        await context.establish();
        seen = [];
        const id = '00112233-4455-6677-8899-aabbccddeeff';
        const subscription = context.models.observeById(id).subscribe(row => seen.push(row?.title ?? null));
        await settle();
        context.fixture.database.delete(context.fixture.table).where(eq(context.fixture.table.title, 'z')).run();
        context.handle.notifyChanged(TaskRecord);
        await settle();
        context.fixture.native.run(`insert into tasks values ('${id}', 'again')`);
        context.handle.notifyChanged(TaskRecord);
        await settle();
        subscription.unsubscribe();
    });
    afterEach(async () => { await context.dispose(); });
    it('should emit the missing row and the recreated value', () => { seen.should.deep.equal(['z', null, 'again']); });
}));
