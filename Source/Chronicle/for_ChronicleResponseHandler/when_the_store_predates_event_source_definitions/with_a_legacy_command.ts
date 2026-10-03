// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { context } from '../given/a_registered_command.js';
import { an_event_source_aware_store, PlaceLegacy } from '../../given/event_source_routing.js';

describe('when the store predates event source definitions and a command uses string routing', given(an_event_source_aware_store, setup => {
    it('should append as before', async () => {
        setup.legacy = true;
        const app = await setup.build(PlaceLegacy);
        try {
            const result = await app.server.executeCommand('PlaceLegacy', { id: 'order-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            setup.appended[0]!.eventSourceType!.should.equal('orders');
        } finally { await app.dispose(); }
    });
}));
