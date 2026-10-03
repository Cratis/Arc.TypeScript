// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { context } from '../given/a_registered_command.js';
import { an_event_source_aware_store, DepositLazily, Account } from '../../given/event_source_routing.js';

describe('when a command declares its event source definition lazily', given(an_event_source_aware_store, setup => {
    it('should resolve the class when appending', async () => {
        const app = await setup.build(DepositLazily);
        try {
            const result = await app.server.executeCommand('DepositLazily', { id: 'account-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            setup.appended[0]!.eventSource!.should.equal(Account);
        } finally { await app.dispose(); }
    });
}));
