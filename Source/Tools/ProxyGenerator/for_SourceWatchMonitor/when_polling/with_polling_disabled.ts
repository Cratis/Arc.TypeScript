// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_source_watch } from '../given/a_source_watch.js';

describe('when polling is disabled', given(a_source_watch, context => {
    beforeEach(async () => {
        await context.establish(0);
        await context.clock.tickAsync(60000);
        context.reader.file.resolves({ signature: 'changed' });
        await context.monitor.notify('/external/Service.ts');
    });
    afterEach(() => context.cleanup());
    it('should not perform a fallback scan', () => context.reader.directory.called.should.be.false);
    it('should continue checking native external source notifications', () => context.reader.file.calledOnceWithExactly('/external/Service.ts', false).should.be.true);
    it('should continue regenerating for native changes', () => context.changed.calledOnce.should.be.true);
}));
