// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_event_source_aware_store, DepositContradictingLegacy } from '../../given/event_source_routing.js';

describe('when a command declares string routing that contradicts its definition', given(an_event_source_aware_store, setup => {
    let failure: Error | undefined;
    beforeEach(async () => {
        try { await (await setup.build(DepositContradictingLegacy)).dispose(); } catch (error) { failure = error as Error; }
    });
    it('should refuse to build', () => {
        failure!.message.should.contain('DepositContradictingLegacy');
        failure!.message.should.contain('contradicts');
    });
}));
