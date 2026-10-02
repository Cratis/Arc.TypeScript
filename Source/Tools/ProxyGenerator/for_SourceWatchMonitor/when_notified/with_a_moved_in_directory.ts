// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Dirent } from 'node:fs';
import { given } from '../../given.js';
import { a_source_watch } from '../given/a_source_watch.js';

describe('when notified with a moved in directory and polling disabled', given(a_source_watch, context => {
    beforeEach(async () => {
        await context.establish(0);
        context.reader.isDirectory.resolves(true);
        context.reader.directory.withArgs('/artifacts').resolves([
            { name: 'Save.ts', isDirectory: () => false } as Dirent,
            { name: 'Nested', isDirectory: () => true } as Dirent
        ]);
        context.reader.directory.withArgs('/artifacts/Nested').resolves([
            { name: 'Added.ts', isDirectory: () => false } as Dirent
        ]);
        await context.monitor.notify('/artifacts/Nested');
    });
    afterEach(() => context.cleanup());
    it('should check sources inside the new directory immediately', () => context.reader.file.calledWithExactly('/artifacts/Nested/Added.ts', false).should.be.true);
    it('should regenerate for the added source', () => context.changed.calledOnce.should.be.true);
}));
