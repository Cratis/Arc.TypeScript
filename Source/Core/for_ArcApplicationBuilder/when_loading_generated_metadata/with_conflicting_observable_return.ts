// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, canonicalMetadataSignature, query, readModel } from '../../index.js';

@readModel()
class DeclaredSnapshot {
    @query({ observable: true }) static lookup(): string { return 'snapshot'; }
}

describe('when building a query whose observable declaration conflicts with its return metadata', () => {
    let error: unknown;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.useGeneratedMetadata({ version: 1, artifacts: [{ type: DeclaredSnapshot,
            signature: canonicalMetadataSignature('DeclaredSnapshot', [], null, null, [['lookup', 0]]),
            metadata: { readModel: true, queryMethods: new Map([['lookup', { observable: false,
                result: { cardinality: 'one', nullable: false, observable: false, element: String } }]]) } }] });
        builder.add(DeclaredSnapshot);
        try { await builder.build(); }
        catch (failure) { error = failure; }
    });
    it('should reject the mismatch before serving requests', () => {
        (error as Error).message.should.contain('observable declaration does not match');
    });
});
