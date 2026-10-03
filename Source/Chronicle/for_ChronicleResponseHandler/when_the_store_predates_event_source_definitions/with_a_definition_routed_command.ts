// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { context } from '../given/a_registered_command.js';
import { an_event_source_aware_store, Deposit } from '../../given/event_source_routing.js';

describe('when the store predates event source definitions and a command selects one', given(an_event_source_aware_store, setup => {
    it('should fail clearly and append nothing', async () => {
        setup.legacy = true;
        const app = await setup.build(Deposit);
        try {
            const result = await app.server.executeCommand('Deposit', { id: 'account-1' }, context());
            result.isSuccess.should.equal(false);
            result.exceptionMessages.join().should.contain('6.49.0');
            setup.appendMany.called.should.equal(false);
        } finally { await app.dispose(); }
    });
}));
