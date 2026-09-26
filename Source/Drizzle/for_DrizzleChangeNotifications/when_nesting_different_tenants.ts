// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { Task, a_notification_bus } from './given/a_notification_bus.js';

describe('when a command for tenant B nests inside a command for tenant A', given(a_notification_bus, context => {
    let beforeACompletes: string[];
    beforeEach(async () => {
        context.hits.length = 0;
        await context.bus.run('a', async () => {
            context.bus.notify('a', [Task]);
            await context.bus.run('b', async () => {
                context.bus.notify('a', [Task]);
                context.bus.notify('b', [Task]);
            });
            beforeACompletes = [...context.hits];
        });
    });
    it('should not publish A while B completes', () => { beforeACompletes.should.deep.equal(['b']); });
    it('should publish A once at its own completion', () => { context.hits.should.deep.equal(['b', 'a']); });
}));
