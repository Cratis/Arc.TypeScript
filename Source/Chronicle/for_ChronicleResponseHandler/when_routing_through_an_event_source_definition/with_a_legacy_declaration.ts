// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { context } from '../given/a_registered_command.js';
import { an_event_source_aware_store, PlaceLegacy } from '../../given/event_source_routing.js';

describe('when a command only declares string routing', given(an_event_source_aware_store, setup => {
    it('should keep appending with the string routing and no definition', async () => {
        const app = await setup.build(PlaceLegacy);
        try {
            const result = await app.server.executeCommand('PlaceLegacy', { id: 'account-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            setup.appended[0]!.eventSourceType!.should.equal('orders');
            setup.appended[0]!.eventStreamType!.should.equal('active');
            ('eventSource' in setup.appended[0]!).should.equal(false);
            ('eventStream' in setup.appended[0]!).should.equal(false);
        } finally { await app.dispose(); }
    });
}));
