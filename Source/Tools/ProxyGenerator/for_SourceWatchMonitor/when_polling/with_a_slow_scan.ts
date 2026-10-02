// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_source_watch } from '../given/a_source_watch.js';

describe('when polling with a slow scan', given(a_source_watch, context => {
    let scansBeforeDelay: number;
    let scansDuringScan: number;
    beforeEach(async () => {
        await context.establish(1000);
        context.reader.directory.callsFake(async () => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return [];
        });
        await context.clock.tickAsync(2999);
        scansDuringScan = context.reader.directory.callCount;
        await context.clock.tickAsync(1);
        await context.clock.tickAsync(7999);
        scansBeforeDelay = context.reader.directory.callCount;
        context.reader.directory.resolves([]);
        await context.clock.tickAsync(1);
    });
    afterEach(() => context.cleanup());
    it('should not overlap scans even if they exceed the interval', () => scansDuringScan.should.equal(1));
    it('should wait four scan durations after completion', () => scansBeforeDelay.should.equal(1));
    it('should resume once the adaptive delay expires', () => context.reader.directory.callCount.should.equal(2));
}));
