// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { context } from '../../for_ChronicleResponseHandler/given/a_registered_command.js';
import { an_event_source_aware_store, CreditOtherLedger } from '../../given/event_source_routing.js';

describe('when an aggregate and its command select different definitions', given(an_event_source_aware_store, setup => {
    it('should fail instead of choosing one', async () => {
        const app = await setup.build(CreditOtherLedger);
        try {
            const result = await app.server.executeCommand('CreditOtherLedger', { id: 'wallet-1' }, context());
            result.isSuccess.should.equal(false);
            result.exceptionMessages.join().should.contain('different event source definitions');
            setup.appendMany.called.should.equal(false);
        } finally { await app.dispose(); }
    });
}));
