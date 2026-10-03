// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { context } from '../given/a_registered_command.js';
import { an_event_source_aware_store, DepositWithFlags } from '../../given/event_source_routing.js';

describe('when a command with a definition also sets concurrency flags', given(an_event_source_aware_store, setup => {
    it('should use the explicit scope built from the resolved routing instead of the definition concurrency', async () => {
        const app = await setup.build(DepositWithFlags);
        try {
            const result = await app.server.executeCommand('DepositWithFlags', { id: 'account-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            const scope = setup.appendMany.firstCall.args[1].concurrencyScopes['account-1'];
            scope.sequenceNumber.should.equal(5n);
            scope.eventStreamId.should.equal('2026-05');
            (scope.eventStreamType === undefined).should.equal(true);
            setup.getTailSequenceNumber.firstCall.args.slice(1).should.deep.equal([undefined, undefined, '2026-05']);
        } finally { await app.dispose(); }
    });
}));
