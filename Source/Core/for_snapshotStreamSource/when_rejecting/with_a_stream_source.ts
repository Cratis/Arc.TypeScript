// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { SnapshotStreamError } from '../../queries/modelBound/snapshotStreamSource.js';

describe('when carrying a rejected snapshot stream source', () => {
    it('should not expose the source to structured logging', () => {
        const source = { subscribe: () => ({}) };
        const failure = new SnapshotStreamError('snapshot failed', source);
        failure.name.should.equal('SnapshotStreamError');
        failure.source.should.equal(source);
        Object.keys(failure).should.not.contain('source');
        JSON.stringify(failure).should.not.contain('source');
    });
});
