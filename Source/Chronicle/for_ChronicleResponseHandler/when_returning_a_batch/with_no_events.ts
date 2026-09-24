// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_registered_command, context } from '../given/a_registered_command.js';

describe('when returning an empty event list', given(a_registered_command, setup => {
    it('should succeed without appending or returning a client array', async () => {
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('CreateEmpty', { id: 'task-1' }, context());
            result.isSuccess.should.equal(true);
            (result.response === undefined).should.equal(true);
            setup.appendMany.called.should.equal(false);
        } finally { await app.dispose(); }
    });
}));
