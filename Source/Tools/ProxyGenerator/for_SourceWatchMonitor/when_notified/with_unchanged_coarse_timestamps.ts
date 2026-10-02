// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_source_watch } from '../given/a_source_watch.js';

describe('when notified with unchanged coarse timestamps but different content', given(a_source_watch, context => {
    beforeEach(async () => {
        await context.establish(0, { signature: 'same', hash: 'before' });
        await context.clock.tickAsync(3000); // The native event can arrive after the racy window.
        context.reader.file.resolves({ signature: 'same', hash: 'after' });
        await context.monitor.notify('/artifacts/Save.ts');
    });
    afterEach(() => context.cleanup());
    it('should compare content despite unchanged stat identity', () => context.reader.file.calledOnceWithExactly('/artifacts/Save.ts', true).should.be.true);
    it('should request regeneration', () => context.changed.calledOnce.should.be.true);
}));
