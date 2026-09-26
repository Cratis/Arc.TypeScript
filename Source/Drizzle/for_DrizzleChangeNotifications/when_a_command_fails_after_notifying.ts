// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { Task, a_notification_bus } from './given/a_notification_bus.js';

describe('when a command fails after announcing a write', given(a_notification_bus, context => {
    beforeEach(async () => {
        context.hits.length = 0;
        try { await context.bus.run('a', async () => { context.bus.notify('a', [Task]); throw Error('failed'); }); }
        catch { /* A nontransactional write may have persisted. */ }
    });
    it('should publish the announcement despite the command failure', () => { context.hits.should.deep.equal(['a']); });
}));
