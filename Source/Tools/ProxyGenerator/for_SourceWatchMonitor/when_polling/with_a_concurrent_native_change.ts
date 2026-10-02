// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_source_watch } from '../given/a_source_watch.js';

describe('when a native change arrives during a fallback scan', given(a_source_watch, context => {
    beforeEach(async () => {
        await context.establish();
        const source = context.reader.file.withArgs('/artifacts/Save.ts');
        source.onFirstCall().callsFake(async () => {
            await new Promise(resolve => setTimeout(resolve, 600));
            return { signature: 'before' };
        });
        source.onSecondCall().resolves({ signature: 'after' });
        source.onThirdCall().resolves({ signature: 'after' });
        await context.clock.tickAsync(1000);
        await context.monitor.notify('/artifacts/Save.ts');
        await context.clock.tickAsync(600);
        await context.monitor.notify('/artifacts/Save.ts');
    });
    afterEach(() => context.cleanup());
    it('should not overwrite the native checkpoint with an older scan result', () => context.changed.calledOnce.should.be.true);
}));
