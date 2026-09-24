// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_registered_command, context } from '../given/a_registered_command.js';

describe('when returning ordinary data with event-shaped fields', given(a_registered_command, setup => {
    it('should return the data without treating it as a routed event', async () => {
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('ReturnEventShapedData', { id: 'task-1' }, context());
            result.isSuccess.should.equal(true);
            (result.response as { eventSourceId: string }).eventSourceId.should.equal('not-a-stream');
            setup.appendMany.called.should.equal(false);
        } finally { await app.dispose(); }
    });
}));
