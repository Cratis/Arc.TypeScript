// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, canonicalMetadataSignature, query, readModel } from '../../index.js';

@readModel()
class ChangedModel {
    @query() static find(name: string): string { return name; }
}

describe('when loading metadata for a changed source class', () => {
    let error: unknown;
    beforeEach(() => {
        const signature = canonicalMetadataSignature('ChangedModel', [], null, null, [['find', 0]]);
        try {
            ArcApplication.createBuilder().useGeneratedMetadata({ version: 1, artifacts: [{ type: ChangedModel, signature,
                metadata: { readModel: true, queryMethods: new Map([['find', { observable: false }]]) } }] });
        } catch (failure) { error = failure; }
    });
    it('should reject a method whose real arity differs from the generated declaration', () => {
        (error as Error).message.should.contain('Stale generated artifact metadata for ChangedModel');
    });
});
