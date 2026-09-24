// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_registered_command, context } from '../given/a_registered_command.js';

describe('when returning an event with an ordinary message response', given(a_registered_command, setup => {
    it('should append to the command key rather than the message', async () => {
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('CreateWithMessage', { id: 'task-1' }, context());
            result.isSuccess.should.equal(true);
            String(result.response).should.equal('Task created');
            setup.appendMany.firstCall.args[0][0].eventSourceId.should.equal('task-1');
        } finally { await app.dispose(); }
    });
}));
