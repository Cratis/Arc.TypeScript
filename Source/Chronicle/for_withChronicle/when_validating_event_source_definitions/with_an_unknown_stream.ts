// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_event_source_aware_store, DepositToMissingStream } from '../../given/event_source_routing.js';

describe('when a command selects a stream its definition does not declare', given(an_event_source_aware_store, setup => {
    let failure: Error | undefined;
    beforeEach(async () => {
        try { await (await setup.build(DepositToMissingStream)).dispose(); } catch (error) { failure = error as Error; }
    });
    it('should refuse to build and name the declared streams', () => {
        failure!.message.should.contain('DepositToMissingStream');
        failure!.message.should.contain('does not declare');
    });
}));
