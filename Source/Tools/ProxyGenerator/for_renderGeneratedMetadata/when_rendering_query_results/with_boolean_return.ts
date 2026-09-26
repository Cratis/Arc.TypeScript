// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';

const root = resolve(import.meta.dirname, '../../for_commandResponseType/given');

describe('when rendering a query with a boolean return', () => {
    let metadata: string;
    beforeEach(() => {
        metadata = renderGeneratedMetadata(resolve(root, 'tsconfig.json'), resolve(root, 'Features'), resolve(root, 'generatedMetadata.ts'));
    });
    it('should include the boolean element token in its result metadata', () => {
        const entry = metadata.split('\n').find(line => line.includes('\\"name\\":\\"LiteralQueries\\"'))!;
        entry.should.contain("result: { cardinality: 'one', nullable: false, element: Boolean, observable: false }");
    });
});
