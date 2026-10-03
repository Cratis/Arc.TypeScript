// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { context } from '../given/a_registered_command.js';
import { an_event_source_aware_store, PostRaw } from '../../given/event_source_routing.js';

describe('when an event carries a raw stream type under a command definition', given(an_event_source_aware_store, setup => {
    it('should win over the command definition rather than be rewritten through it', async () => {
        const app = await setup.build(PostRaw);
        try {
            const result = await app.server.executeCommand('PostRaw', { id: 'account-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            setup.appended[0]!.eventStreamType!.should.equal('raw-stream');
            ('eventSource' in setup.appended[0]!).should.equal(false);
            ('eventStream' in setup.appended[0]!).should.equal(false);
            (setup.appended[0]!.eventSourceType === undefined).should.equal(true);
        } finally { await app.dispose(); }
    });
}));
