// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_registered_command, context } from '../given/a_registered_command.js';

describe('when returning a batch of ordinary data', given(a_registered_command, setup => {
    it('should return the data without contacting Chronicle', async () => {
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('ReturnData', { name: 'order' }, context());
            result.isSuccess.should.equal(true);
            JSON.stringify(result.response).should.equal('[{"name":"order"}]');
            setup.appendMany.called.should.equal(false);
            setup.getEventStore.called.should.equal(false);
        } finally { await app.dispose(); }
    });
}));
