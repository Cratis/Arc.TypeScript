// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import fs from 'node:fs/promises';
import sinon from 'sinon';
import { SourceWatchReader } from '../../SourceWatchReader.js';

describe('when checking a removed directory', () => {
    let directory: boolean | undefined;
    beforeEach(async () => {
        sinon.stub(fs, 'stat').rejects(Object.assign(new Error('removed'), { code: 'ENOENT' }));
        directory = await new SourceWatchReader('/artifacts').isDirectory('/artifacts/Nested');
    });
    afterEach(() => sinon.restore());
    it('should distinguish absence from an unrelated regular file', () => (directory === undefined).should.equal(true));
});
