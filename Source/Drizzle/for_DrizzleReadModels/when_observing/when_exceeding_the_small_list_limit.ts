// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_observation_scope, settle } from '../given/an_observation_scope.js';

describe('when a SQL observation outgrows its complete-list limit', given(an_observation_scope, context => {
    let error: string;
    let emitted: number[];
    beforeEach(async () => {
        await context.establish(2);
        const observed = context.models.observe();
        emitted = [];
        let fail!: (message: string) => void;
        const failed = new Promise<string>(resolve => { fail = resolve; });
        const subscription = observed.subscribe({ next: rows => emitted.push(rows.length),
            error: (reason: Error) => fail(reason.message) });
        await settle();
        context.fixture.native.run("insert into tasks values ('31112233-4455-6677-8899-aabbccddeeff', 'new')");
        context.handle.notifyChanged(context.fixture.table);
        error = await failed;
        subscription.unsubscribe();
    });
    afterEach(async () => { await context.dispose(); });
    it('should fail with the paging error', () => {
        error.should.equal('The result exceeds the maximum of 2 items; narrow the filter, or use observePage through defineObservableQuery for paged results');
    });
    it('should never emit a truncated later list', () => { emitted.should.deep.equal([2]); });
}));
