// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_source_watch } from '../given/a_source_watch.js';

describe('when notified with a source filename', given(a_source_watch, context => {
    beforeEach(async () => {
        await context.establish();
        context.reader.file.resolves({ signature: 'after' });
        await context.monitor.notify('/artifacts/Save.ts');
    });
    afterEach(() => context.cleanup());
    it('should check only the named file', () => context.reader.file.calledOnceWithExactly('/artifacts/Save.ts', false).should.be.true);
    it('should not walk the artifact tree', () => context.reader.directory.called.should.be.false);
    it('should request regeneration', () => context.changed.calledOnce.should.be.true);
}));
