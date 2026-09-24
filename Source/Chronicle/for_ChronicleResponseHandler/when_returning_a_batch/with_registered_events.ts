// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_registered_command, context } from '../given/a_registered_command.js';

describe('when returning a batch of registered events', given(a_registered_command, setup => {
    it('should send both events in one append call', async () => {
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('CreateMany', { id: 'one' }, context());
            result.isSuccess.should.equal(true);
            setup.appendMany.calledOnce.should.equal(true);
            setup.appendMany.firstCall.args[0].should.have.lengthOf(2);
        } finally { await app.dispose(); }
    });
}));
