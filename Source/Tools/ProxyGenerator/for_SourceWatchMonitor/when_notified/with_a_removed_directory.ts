// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_source_watch } from '../given/a_source_watch.js';

describe('when notified with a removed directory and polling disabled', given(a_source_watch, context => {
    beforeEach(async () => {
        await context.establish(0);
        await context.monitor.notify('/artifacts/Nested/Old.ts');
        context.changed.resetHistory();
        context.reader.isDirectory.resolves(undefined);
        await context.monitor.notify('/artifacts/Nested');
    });
    afterEach(() => context.cleanup());
    it('should reconcile the known subtree without waiting for a poll', () => context.reader.directory.calledOnceWithExactly('/artifacts').should.be.true);
    it('should regenerate for the removed source', () => context.changed.calledOnce.should.be.true);
}));
