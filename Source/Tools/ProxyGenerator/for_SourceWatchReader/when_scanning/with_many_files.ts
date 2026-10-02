// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import fs from 'node:fs/promises';
import sinon from 'sinon';
import { sourceWatchSnapshot } from '../../sourceWatchSnapshot.js';

describe('when scanning many source files', () => {
    let maximum: number;
    let size: number;
    beforeEach(async () => {
        let active = 0;
        maximum = 0;
        sinon.stub(fs, 'readdir').resolves(Array.from({ length: 128 }, (_, index) =>
            ({ name: `File${index}.ts`, isDirectory: () => false })) as unknown as Awaited<ReturnType<typeof fs.readdir>>);
        sinon.stub(fs, 'stat').callsFake(async () => {
            active++;
            maximum = Math.max(maximum, active);
            await Promise.resolve();
            active--;
            return { mtimeNs: 0n, ctimeNs: 0n, size: 1n, ino: 1n, isFile: () => true } as Awaited<ReturnType<typeof fs.stat>>;
        });
        size = (await sourceWatchSnapshot('/artifacts', new Set(), () => false)).size;
    });
    afterEach(() => sinon.restore());
    it('should stat in parallel but never more than thirty two files', () => maximum.should.equal(32));
    it('should retain every source file', () => size.should.equal(128));
});
