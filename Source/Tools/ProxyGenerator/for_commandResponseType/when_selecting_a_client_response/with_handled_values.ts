// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { given } from '../../given.js';
import { analyzeSource } from '../../analyzeSource.js';

class response_declarations {
    readonly root = resolve(import.meta.dirname, '../given');
    readonly project = resolve(this.root, 'tsconfig.json');
    readonly artifacts = resolve(this.root, 'Features');
}

describe('when selecting a command client response with handled values', given(response_declarations, context => {
    let analysis: ReturnType<typeof analyzeSource>;
    beforeEach(() => { analysis = analyzeSource(context.project, context.artifacts); });
    it('should omit handled values without creating client event models', () => {
        for (const name of ['JustEvent', 'AsyncEvents', 'JustOperation', 'Operation', 'Routed', 'Scoped', 'Committed', 'EventOrNothing'])
            analysis.operations.find(item => item.name === name)!.result.void.should.equal(true, name);
        analysis.models.map(item => item.name).should.not.include('Registered');
    });
}));
