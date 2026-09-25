// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { given } from '@cratis/arc.testing';
import { analyzeSource } from '../../analyzeSource.js';

class a_tasks_slice {
    readonly root = resolve(import.meta.dirname, '../../../../../Samples/Tasks');
    readonly project = resolve(this.root, 'tsconfig.json');
    readonly artifacts = resolve(this.root, 'Features');
}

describe('when analyzing a slice with several exported artifacts', given(a_tasks_slice, context => {
    let analysis: ReturnType<typeof analyzeSource>;
    beforeEach(() => { analysis = analyzeSource(context.project, context.artifacts, '', true); });
    it('should generate one operation per command and read-model query', () => {
        analysis.operations.map(operation => operation.name).should.include('RegisterTask').and.include('allTasks');
    });
}));
