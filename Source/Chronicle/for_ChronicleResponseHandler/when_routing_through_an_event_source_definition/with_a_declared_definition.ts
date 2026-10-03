// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { context } from '../given/a_registered_command.js';
import { an_event_source_aware_store, Deposit, Account } from '../../given/event_source_routing.js';

describe('when a command declares an event source definition', given(an_event_source_aware_store, setup => {
    it('should record the definition and its stream on each event without choosing a concurrency scope', async () => {
        const app = await setup.build(Deposit);
        try {
            const result = await app.server.executeCommand('Deposit', { id: 'account-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            setup.appended[0]!.eventSource!.should.equal(Account);
            setup.appended[0]!.eventStream!.should.equal('Transactions');
            (setup.appended[0]!.eventSourceType === undefined).should.equal(true);
            (setup.appendMany.firstCall.args[1].concurrencyScopes === undefined).should.equal(true);
        } finally { await app.dispose(); }
    });
}));
