// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import fs from 'node:fs/promises';
import sinon from 'sinon';
import { SourceWatchReader } from '../../SourceWatchReader.js';
import { sourceWatchSnapshot } from '../../sourceWatchSnapshot.js';

for (const code of ['ENOENT', 'ENOTDIR', 'EPERM', 'EACCES', 'EBUSY', 'ELOOP']) {
    describe(`when scanning with inaccessible children (${code})`, () => {
        let warning: sinon.SinonStub;
        let size: number;
        beforeEach(async () => {
            const error = Object.assign(new Error('unavailable'), { code });
            warning = sinon.stub(console, 'warn');
            sinon.stub(fs, 'stat').rejects(error);
            sinon.stub(fs, 'readdir').callsFake(async path => {
                if (path !== '/artifacts') throw error;
                return [{ name: 'Denied.ts', isDirectory: () => false }, { name: 'Nested', isDirectory: () => true }] as unknown as Awaited<ReturnType<typeof fs.readdir>>;
            });
            const reader = new SourceWatchReader('/artifacts');
            await sourceWatchSnapshot('/artifacts', new Set(['/external/Denied.ts']), () => false, reader);
            size = (await sourceWatchSnapshot('/artifacts', new Set(['/external/Denied.ts']), () => false, reader)).size;
        });
        afterEach(() => sinon.restore());
        it('should skip inaccessible entries on the initial and subsequent snapshots', () => size.should.equal(0));
        it('should report each failing path at most once', () => {
            new Set(warning.getCalls().map(call => call.args[0])).size.should.equal(warning.callCount);
            warning.callCount.should.be.at.most(3);
        });
    });
}
