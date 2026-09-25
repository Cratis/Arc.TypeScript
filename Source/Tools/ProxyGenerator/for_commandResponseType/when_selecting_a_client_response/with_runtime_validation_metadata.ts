// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';

const root = resolve(import.meta.dirname, '../given');

describe('when selecting a command client response with runtime validation metadata', () => {
    let metadata: string;
    beforeEach(() => {
        metadata = renderGeneratedMetadata(resolve(root, 'tsconfig.json'), resolve(root, 'Features'), resolve(root, 'generatedMetadata.ts'));
    });
    it('should describe the client response and retain the raw handle shape for runtime validation', () => {
        metadata.should.contain("handleResult: { cardinality: 'void', nullable: false }, handleValueResult: { cardinality: 'one', nullable: false }");
        metadata.should.contain("handleResult: { cardinality: 'one', nullable: false, element: String }, handleValueResult:");
    });
});
