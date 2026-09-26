// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { ClientOperationKind } from '@cratis/arc.core';
import { analyzeSource } from '../analyzeSource.js';

describe('when generating proxy operations for Drizzle observable queries', () => {
    let operations: ReturnType<typeof analyzeSource>['operations'];
    beforeEach(() => {
        const root = resolve(import.meta.dirname, '../../../..');
        operations = analyzeSource(resolve(root, 'tsconfig.specs.json'),
            resolve(root, 'Source/Tools/ProxyGenerator/for_queryResult/given'), '', true).operations;
    });
    it('should recognize the inferred tasks.observe return as an observable array', () => {
        const result = operations.find(operation => operation.name === 'unannotated')!;
        result.kind.should.equal(ClientOperationKind.Observable);
        result.result.enumerable.should.equal(true);
        result.result.text.should.include('TaskRecord');
    });
    it('should recognize an annotated Observable<TaskRecord[]> as the same shape', () => {
        const result = operations.find(operation => operation.name === 'annotated')!;
        result.kind.should.equal(ClientOperationKind.Observable);
        result.result.enumerable.should.equal(true);
        result.result.text.should.include('TaskRecord');
    });
});
