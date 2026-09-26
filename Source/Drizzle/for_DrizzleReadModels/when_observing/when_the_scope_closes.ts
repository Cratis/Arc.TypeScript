// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_observation_scope } from '../given/an_observation_scope.js';

describe('when the read-model scope closes after priming', given(an_observation_scope, context => {
    let closedPrime: boolean;
    let newStart: boolean;
    beforeEach(async () => {
        await context.establish();
        const observed = context.models.observe();
        await observed.current();
        await context.scope.dispose();
        closedPrime = await observed.current().then(() => false, () => true);
        newStart = await context.models.observe().current().then(() => false, () => true);
    });
    afterEach(async () => { await context.dispose(); });
    it('should close the unused prime', () => { closedPrime.should.equal(true); });
    it('should reject further starts from the disposed owner', () => { newStart.should.equal(true); });
}));
