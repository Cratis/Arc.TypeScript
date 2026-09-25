// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { analyzeSource } from '../../analyzeSource.js';
import { renderSource } from '../../renderSource.js';

const root = resolve(import.meta.dirname, '../../../../../Samples/Tasks');

describe('when analyzing a slice with a co-located validator', () => {
    let proxy: string;
    beforeEach(() => {
        const analysis = analyzeSource(resolve(root, 'tsconfig.json'), resolve(root, 'Features'), '', true);
        proxy = renderSource(analysis).get('Tasks/Registration/RegisterTask.ts')!;
    });
    it('should apply the co-located validator to the command proxy', () => {
        proxy.should.include('A title is required');
    });
});
