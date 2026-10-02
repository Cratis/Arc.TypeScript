// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import fs from 'node:fs/promises';
import sinon from 'sinon';
import { SourceWatchReader } from '../../SourceWatchReader.js';
import type { SourceWatchEntry } from '../../SourceWatchEntry.js';

describe('when reading a racy source with unchanged timestamps', () => {
    let clock: sinon.SinonFakeTimers;
    let before: SourceWatchEntry;
    let after: SourceWatchEntry;
    beforeEach(async () => {
        clock = sinon.useFakeTimers({ now: 10000, toFake: ['Date'] });
        sinon.stub(fs, 'stat').resolves({ mtimeNs: 10_000_000_000n, ctimeNs: 10_000_000_000n,
            size: 3n, ino: 1n, isFile: () => true } as Awaited<ReturnType<typeof fs.stat>>);
        const content = sinon.stub(fs, 'readFile').resolves(Buffer.from('one'));
        const reader = new SourceWatchReader('/artifacts');
        before = (await reader.file('/artifacts/Save.ts'))!;
        clock.setSystemTime(14000);
        content.resolves(Buffer.from('two'));
        after = (await reader.file('/artifacts/Save.ts', before.hash !== undefined))!;
    });
    afterEach(() => { clock.restore(); sinon.restore(); });
    it('should keep exactly the same stat identity', () => after.signature.should.equal(before.signature));
    it('should distinguish the changed content even after the racy window', () => {
        (before.hash !== undefined && after.hash !== undefined && before.hash !== after.hash).should.equal(true);
    });
});
