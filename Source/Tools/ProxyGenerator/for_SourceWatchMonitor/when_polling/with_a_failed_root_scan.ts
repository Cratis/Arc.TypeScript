// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_source_watch } from '../given/a_source_watch.js';

describe('when polling with a failed artifacts root scan', given(a_source_watch, context => {
    let failure: Error;
    beforeEach(async () => {
        await context.establish();
        failure = Object.assign(new Error('root unavailable'), { code: 'ENOENT' });
        context.reader.directory.rejects(failure);
        await context.clock.tickAsync(10000);
    });
    afterEach(() => context.cleanup());
    it('should report the terminal root failure', () => context.failed.calledOnceWithExactly(failure).should.be.true);
    it('should not continue scanning after failure', () => context.reader.directory.calledOnce.should.be.true);
}));
