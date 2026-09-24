// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_registered_command, context } from '../given/a_registered_command.js';

describe('when a command returns validation rejection', given(a_registered_command, setup => {
    it('should append nothing', async () => {
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('CreateRejected', { id: 'one' }, context());
            result.isSuccess.should.equal(false);
            setup.appendMany.called.should.equal(false);
            setup.getEventStore.called.should.equal(false);
        } finally { await app.dispose(); }
    });
}));
