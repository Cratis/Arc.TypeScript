// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_source_watch } from '../given/a_source_watch.js';

describe('when notified twice for the same recent content', given(a_source_watch, context => {
    beforeEach(async () => {
        await context.establish(0, { signature: 'same', hash: 'same content' });
        await context.monitor.notify('/artifacts/Save.ts');
        await context.monitor.notify('/artifacts/Save.ts');
    });
    afterEach(() => context.cleanup());
    it('should not regenerate unchanged content', () => context.changed.called.should.be.false);
}));
