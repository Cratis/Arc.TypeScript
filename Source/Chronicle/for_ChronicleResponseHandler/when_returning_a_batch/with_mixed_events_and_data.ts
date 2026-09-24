// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_registered_command, context } from '../given/a_registered_command.js';

describe('when returning a batch with registered events and ordinary data', given(a_registered_command, setup => {
    it('should reject the batch without appending any event', async () => {
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('CreateMixed', { id: 'task-1' }, context());
            result.isSuccess.should.equal(false);
            setup.appendMany.called.should.equal(false);
        } finally { await app.dispose(); }
    });
}));
