// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { given } from '@cratis/arc.testing';
import { analyzeSource } from '../../analyzeSource.js';
import { renderSource } from '../../renderSource.js';
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';

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
    it('should apply the co-located validator to the command proxy', () => {
        renderSource(analysis).get('Tasks/Registration/RegisterTask.ts')!.should.include('A title is required');
    });
    it('should bind both exports to the slice module in generated metadata', () => {
        const result = renderGeneratedMetadata(context.project, context.artifacts, resolve(context.root, 'Features/generatedMetadata.ts'));
        result.should.include('Registration/Registration.js');
        result.should.include('validatorTarget:');
    });
}));
