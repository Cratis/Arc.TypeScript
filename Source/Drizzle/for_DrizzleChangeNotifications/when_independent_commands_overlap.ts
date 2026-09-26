// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { Task, a_notification_bus } from './given/a_notification_bus.js';

describe('when two independent commands for the same tenant overlap', given(a_notification_bus, context => {
    let whileFirstIsBlocked: string[];
    beforeEach(async () => {
        context.hits.length = 0;
        let unblock!: () => void;
        const blocked = new Promise<void>(resolve => { unblock = resolve; });
        const first = context.bus.run('a', async () => { context.bus.notify('a', [Task]); await blocked; });
        await context.bus.run('a', async () => { context.bus.notify('a', [Task]); });
        whileFirstIsBlocked = [...context.hits];
        unblock();
        await first;
    });
    it('should flush the second command independently', () => { whileFirstIsBlocked.should.deep.equal(['a']); });
    it('should flush the first command when it finishes', () => { context.hits.should.deep.equal(['a', 'a']); });
}));
