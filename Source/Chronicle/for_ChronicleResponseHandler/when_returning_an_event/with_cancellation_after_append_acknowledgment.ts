// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { accepted } from '../../for_ChronicleCommand/given/a_command_with_typed_ports.js';
import { a_registered_command, context } from '../given/a_registered_command.js';

describe('when canceling after an inline Chronicle response append is acknowledged', given(a_registered_command, setup => {
    it('should return the response for the appended event', async () => {
        const abort = new AbortController();
        setup.appendMany.callsFake(async () => {
            abort.abort(new Error('request canceled'));
            return [accepted()];
        });
        const application = await setup.build();
        try {
            const result = await application.server.executeCommand('CreateWithMessage', { id: 'source-1', name: 'Ada' },
                { ...context(), signal: abort.signal });
            result.isSuccess.should.equal(true);
            result.response!.should.equal('Task created');
            setup.appendMany.calledOnce.should.equal(true);
        } finally { await application.dispose(); }
    });
}));
