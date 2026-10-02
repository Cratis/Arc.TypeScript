// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_source_watch } from '../given/a_source_watch.js';

describe('when polling a previously racy checkpoint after three seconds', given(a_source_watch, context => {
    beforeEach(async () => {
        await context.establish(3000, { signature: 'same', hash: 'before' });
        context.reader.file.callsFake(async (_path, compareHash) => ({
            signature: 'same', hash: compareHash ? 'after' : undefined
        }));
        await context.clock.tickAsync(6000);
    });
    afterEach(() => context.cleanup());
    it('should retain the content comparison on every later scan', () => {
        context.reader.file.getCalls().every(call => call.args[1] === true).should.equal(true);
        context.reader.file.callCount.should.equal(4);
    });
    it('should regenerate once for the missed edit despite identical stat identities', () => context.changed.calledOnce.should.be.true);
}));
