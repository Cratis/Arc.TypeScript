// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, canonicalMetadataSignature, query, readModel } from '../../index.js';

@readModel()
class MixedQueries {
    @query() static by_id(id: string): string { return id; }
    @query() static byIdA(): string { return ''; }
}

describe('when loading generated metadata for case-differing queries', () => {
    let error: unknown;
    beforeEach(() => {
        const signature = canonicalMetadataSignature('MixedQueries', [], null, null, [['byIdA', 0], ['by_id', 1]]);
        try {
            ArcApplication.createBuilder().useGeneratedMetadata({ version: 1, artifacts: [{ type: MixedQueries, signature,
                metadata: { readModel: true, queryMethods: new Map([
                    ['by_id', { observable: false }], ['byIdA', { observable: false }]
                ]) } }] });
        } catch (failure) { error = failure; }
    });
    it('should accept code-unit ordering regardless of declaration order', () => {
        Boolean(error).should.equal(false);
    });
});
