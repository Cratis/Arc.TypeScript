// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_source_watch } from '../given/a_source_watch.js';

describe('when notified with generated or unrelated filenames', given(a_source_watch, context => {
    beforeEach(async () => {
        await context.establish();
        for (const path of ['/artifacts/Save.proxy.ts', '/artifacts/metadata.ts', '/artifacts/generated/index.ts',
            '/artifacts/icon.png', '/artifacts/View.tsx', '/artifacts/Type.d.ts',
            '/artifacts/node_modules/package/index.ts', '/artifacts/.git/hidden.ts', '/unrelated/Source.ts'])
            await context.monitor.notify(path);
    });
    afterEach(() => context.cleanup());
    it('should not read any source state', () => context.reader.file.called.should.be.false);
    it('should not walk any directory', () => context.reader.directory.called.should.be.false);
    it('should not request regeneration', () => context.changed.called.should.be.false);
}));
