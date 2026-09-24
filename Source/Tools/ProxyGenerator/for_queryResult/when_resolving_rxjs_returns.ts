// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import ts from 'typescript';
import { queryResult } from '../queryResult.js';

describe('when resolving RxJS query returns', () => {
    let results: { name: string; observable: boolean; item: string }[];
    beforeEach(() => {
        const file = resolve('Source/Tools/ProxyGenerator/for_queryResult/given/rxjs_returns.ts');
        const program = ts.createProgram([file], { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext });
        const checker = program.getTypeChecker();
        results = (program.getSourceFile(file)!.statements.filter(ts.isFunctionDeclaration)).map(node => {
            const type = checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(node)!);
            const result = queryResult(type, checker, node);
            return { name: node.name!.text, observable: result.observable, item: checker.typeToString(result.type) };
        });
    });
    it('should classify each RxJS observable and unwrap its item type', () => {
        results.should.deep.equal(['observable', 'subject', 'behavior', 'replay'].map(name =>
            ({ name, observable: true, item: 'string' })));
    });
});
