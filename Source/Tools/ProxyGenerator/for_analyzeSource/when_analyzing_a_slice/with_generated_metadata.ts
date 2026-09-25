// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';

const root = resolve(import.meta.dirname, '../../../../../Samples/Tasks');

describe('when analyzing a slice with generated metadata', () => {
    let result: string;
    beforeEach(() => {
        result = renderGeneratedMetadata(resolve(root, 'tsconfig.json'), resolve(root, 'Features'), resolve(root, 'Features/generatedMetadata.ts'));
    });
    it('should bind both exports to the slice module in generated metadata', () => {
        result.should.include('Registration/Registration.js');
        result.should.include('validatorTarget:');
    });
});
