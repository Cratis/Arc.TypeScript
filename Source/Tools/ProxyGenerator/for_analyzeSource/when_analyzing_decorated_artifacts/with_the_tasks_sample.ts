// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { analyzeSource } from '../../analyzeSource.js';

describe('when analyzing decorated artifacts with the Tasks sample', () => {
    let names: string[];
    beforeEach(() => {
        const root = resolve(process.cwd(), 'Samples/Tasks');
        names = analyzeSource(resolve(root, 'tsconfig.json'), resolve(root, 'Features'), '', true).operations.map(operation => operation.name);
    });
    it('should discover the command and every read-model query', () => {
        names.sort().should.deep.equal(['RegisterTask', 'allTasks', 'observeAllTasks', 'taskById']);
    });
});
