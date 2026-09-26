// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { Task, a_notification_bus } from './given/a_notification_bus.js';

describe('when a timer inherited from a completed command announces a change', given(a_notification_bus, context => {
    let afterCommand: string[];
    beforeEach(async () => {
        context.hits.length = 0;
        let notifyLater!: () => void;
        const late = new Promise<void>(resolve => { notifyLater = resolve; });
        const timer = new Promise<void>(resolve => {
            void context.bus.run('a', async () => {
                setTimeout(() => { void late.then(() => { context.bus.notify('a', [Task]); resolve(); }); }, 0);
            });
        });
        await new Promise<void>(resolve => setImmediate(resolve));
        afterCommand = [...context.hits];
        notifyLater();
        await timer;
    });
    it('should not publish before the timer fires', () => { afterCommand.should.deep.equal([]); });
    it('should publish immediately after completion', () => { context.hits.should.deep.equal(['a']); });
}));
