// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_observation_scope, settle } from '../given/an_observation_scope.js';
import type { TaskRecord } from '../given/TaskRecord.js';

describe('when subscribing after a change to a primed snapshot', given(an_observation_scope, context => {
    let initial: number;
    let emissions: TaskRecord[][];
    beforeEach(async () => {
        await context.establish();
        const observed = context.models.observe();
        initial = (await observed.current()).value.length;
        context.fixture.native.run("insert into tasks values ('21112233-4455-6677-8899-aabbccddeeff', 'new')");
        context.handle.notifyChanged(context.fixture.table);
        emissions = [];
        const subscription = observed.subscribe(rows => emissions.push(rows));
        await settle();
        subscription.unsubscribe();
    });
    afterEach(async () => { await context.dispose(); });
    it('should have primed the original snapshot', () => { initial.should.equal(2); });
    it('should read the change after adoption', () => { emissions.map(rows => rows.length).should.deep.equal([2, 3]); });
}));
