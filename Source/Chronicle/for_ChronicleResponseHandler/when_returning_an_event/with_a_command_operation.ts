// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_registered_command, context, operationExecuted } from '../given/a_registered_command.js';

describe('when returning an event and a command operation', given(a_registered_command, setup => {
    it('should reject the combination before any effect executes', async () => {
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('CreateWithOperation', { id: 'task-1' }, context());
            result.isSuccess.should.equal(false);
            operationExecuted.should.equal(false);
            setup.appendMany.called.should.equal(false);
        } finally { await app.dispose(); }
    });
}));
