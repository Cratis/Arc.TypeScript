// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Dirent } from 'node:fs';
import { given } from '../../given.js';
import { a_source_watch } from '../given/a_source_watch.js';

describe('when a directory notification arrives during a fallback scan', given(a_source_watch, context => {
    let scansDuringNotification: number;
    beforeEach(async () => {
        await context.establish();
        const entries = [{ name: 'Save.ts', isDirectory: () => false } as Dirent];
        context.reader.directory.callsFake(async () => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return entries;
        });
        context.reader.isDirectory.resolves(true);
        await context.clock.tickAsync(1000);
        const notified = context.monitor.notify('/artifacts/Nested');
        await context.clock.tickAsync(0);
        scansDuringNotification = context.reader.directory.callCount;
        context.reader.directory.resolves(entries);
        await context.clock.tickAsync(2000);
        await notified;
    });
    afterEach(() => context.cleanup());
    it('should not overlap the running scan', () => scansDuringNotification.should.equal(1));
    it('should reconcile again after the running scan finishes', () => context.reader.directory.callCount.should.equal(2));
}));
