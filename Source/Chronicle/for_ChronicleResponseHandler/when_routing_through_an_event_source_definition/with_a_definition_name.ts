// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { context } from '../given/a_registered_command.js';
import { an_event_source_aware_store, DepositByName } from '../../given/event_source_routing.js';

describe('when a command declares its event source definition by name', given(an_event_source_aware_store, setup => {
    it('should hand the name to Chronicle, which resolves it', async () => {
        const app = await setup.build(DepositByName);
        try {
            const result = await app.server.executeCommand('DepositByName', { id: 'account-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            setup.appended[0]!.eventSource!.should.equal('Account');
            (setup.appended[0]!.eventStream === undefined).should.equal(true);
        } finally { await app.dispose(); }
    });
}));
