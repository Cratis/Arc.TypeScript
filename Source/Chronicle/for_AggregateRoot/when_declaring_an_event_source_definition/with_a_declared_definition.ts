// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { context } from '../../for_ChronicleResponseHandler/given/a_registered_command.js';
import { an_event_source_aware_store, Account, Credit, Wallet } from '../../given/event_source_routing.js';

describe('when an aggregate declares an event source definition', given(an_event_source_aware_store, setup => {
    it('should rehydrate only its source and stream and guard the same route', async () => {
        const app = await setup.build(Credit);
        try {
            const result = await app.server.executeCommand('Credit', { id: 'wallet-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            setup.getTailSequenceNumber.firstCall.args.should.deep.equal(['wallet-1', 'Account', 'Transactions', undefined]);
            setup.getForEventSourceIdAndEventTypes.firstCall.args.slice(2).should.deep.equal(['Transactions', undefined, 'Account']);
            const scope = setup.appendMany.firstCall.args[1].concurrencyScopes['wallet-1'];
            scope.should.include({ sequenceNumber: 5n, eventSourceId: true, eventSourceType: 'Account', eventStreamType: 'Transactions' });
            setup.appended[0]!.eventSource!.should.equal(Account);
            setup.appended[0]!.eventStream!.should.equal('Transactions');
            (Wallet.name).should.equal('Wallet');
        } finally { await app.dispose(); }
    });
}));
