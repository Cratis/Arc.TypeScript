// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import fs from 'node:fs/promises';
import sinon from 'sinon';
import { sourceWatchSnapshot } from '../../sourceWatchSnapshot.js';

for (const code of ['ENOENT', 'ENOTDIR', 'EPERM', 'EACCES', 'EBUSY', 'ELOOP']) {
    describe(`when scanning with an inaccessible artifacts root (${code})`, () => {
        let failure: unknown;
        let expected: Error;
        beforeEach(async () => {
            failure = undefined;
            expected = Object.assign(new Error('root unavailable'), { code });
            sinon.stub(fs, 'readdir').rejects(expected);
            try { await sourceWatchSnapshot('/artifacts', new Set(), () => false); }
            catch (error) { failure = error; }
        });
        afterEach(() => sinon.restore());
        it('should propagate the root error rather than accepting an empty baseline', () => {
            (failure === expected).should.equal(true);
        });
    });
}
