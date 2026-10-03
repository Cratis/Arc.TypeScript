// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { context } from '../given/a_registered_command.js';
import { an_event_source_aware_store, DepositAndPost, Account, Ledger } from '../../given/event_source_routing.js';

describe('when a command returns events routed differently', given(an_event_source_aware_store, setup => {
    it('should route each event on its own', async () => {
        const app = await setup.build(DepositAndPost);
        try {
            const result = await app.server.executeCommand('DepositAndPost', { id: 'account-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            setup.appended[0]!.eventSource!.should.equal(Account);
            setup.appended[0]!.eventStream!.should.equal('Transactions');
            setup.appended[1]!.eventSource!.should.equal(Ledger);
            setup.appended[1]!.eventStream!.should.equal('Postings');
        } finally { await app.dispose(); }
    });
}));
