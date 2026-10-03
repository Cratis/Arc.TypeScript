// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { context } from '../given/a_registered_command.js';
import { an_event_source_aware_store, PostToLedger, Ledger } from '../../given/event_source_routing.js';

describe('when an event names its own event source definition', given(an_event_source_aware_store, setup => {
    it('should replace the command definition and stream as a unit', async () => {
        const app = await setup.build(PostToLedger);
        try {
            const result = await app.server.executeCommand('PostToLedger', { id: 'account-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            setup.appended[0]!.eventSource!.should.equal(Ledger);
            setup.appended[0]!.eventStream!.should.equal('Postings');
        } finally { await app.dispose(); }
    });
}));
