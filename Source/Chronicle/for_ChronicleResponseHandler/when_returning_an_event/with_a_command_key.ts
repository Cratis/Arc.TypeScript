// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_registered_command, context } from '../given/a_registered_command.js';

describe('when returning an event with a command key', given(a_registered_command, setup => {
    it('should append the event to the resolved key in the trusted tenant', async () => {
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('Create', { id: 'order-7', name: 'Seven' }, context());
            result.isSuccess.should.equal(true);
            setup.getEventStore.firstCall.args.should.deep.equal(['Tasks', 'one']);
            setup.appendMany.firstCall.args[0][0].eventSourceId.should.equal('order-7');
        } finally { await app.dispose(); }
    });
}));
