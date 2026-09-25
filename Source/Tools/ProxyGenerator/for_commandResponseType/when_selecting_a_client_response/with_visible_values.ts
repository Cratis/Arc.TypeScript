// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { analyzeSource } from '../../analyzeSource.js';

const root = resolve(import.meta.dirname, '../given');

describe('when selecting a command client response with visible values', () => {
    let analysis: ReturnType<typeof analyzeSource>;
    beforeEach(() => { analysis = analyzeSource(resolve(root, 'tsconfig.json'), resolve(root, 'Features')); });
    it('should select the visible value from tuples, unions and id responses', () => {
        for (const name of ['WithId', 'WithResponse', 'EventOrResponse'])
            analysis.operations.find(item => item.name === name)!.result.text.should.equal('string', name);
        analysis.operations.find(item => item.name === 'PlainResult')!.result.text.should.equal('Plain');
        analysis.operations.find(item => item.name === 'PlainArray')!.result.text.should.equal('string[]');
    });
});
