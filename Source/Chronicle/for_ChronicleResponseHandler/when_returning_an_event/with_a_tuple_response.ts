// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_registered_command, context } from '../given/a_registered_command.js';

describe('when returning an event with a tuple response', given(a_registered_command, setup => {
    it('should use the response id as the append target and return it to the client', async () => {
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('CreateWithResponse', { name: 'Seven' }, context());
            result.isSuccess.should.equal(true);
            String(result.response).should.equal('created-1');
            setup.appendMany.firstCall.args[0][0].eventSourceId.should.equal('created-1');
        } finally { await app.dispose(); }
    });
}));
