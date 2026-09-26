// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { Task, a_notification_bus } from './given/a_notification_bus.js';

describe('when parallel nested children announce the same table', given(a_notification_bus, context => {
    let beforeParentCompletes: string[];
    beforeEach(async () => {
        context.hits.length = 0;
        await context.bus.run('a', async () => {
            await Promise.all([context.bus.run('a', async () => { await Promise.resolve(); context.bus.notify('a', [Task]); }),
                context.bus.run('a', async () => { await Promise.resolve(); context.bus.notify('a', [Task]); })]);
            beforeParentCompletes = [...context.hits];
        });
    });
    it('should keep both notifications buffered until the parent completes', () => { beforeParentCompletes.should.deep.equal([]); });
    it('should publish only once', () => { context.hits.should.deep.equal(['a']); });
}));
