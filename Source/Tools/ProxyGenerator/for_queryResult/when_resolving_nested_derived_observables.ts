// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import ts from 'typescript';
import { queryResult } from '../queryResult.js';

function fixture(name: string) {
    const file = resolve('Source/Tools/ProxyGenerator/for_queryResult/given/derived_observable_returns.ts');
    const program = ts.createProgram([file], { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext });
    const checker = program.getTypeChecker();
    const node = program.getSourceFile(file)!.statements.filter(ts.isFunctionDeclaration).find(node => node.name!.text === name)!;
    const type = checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(node)!);
    return { checker, node, type };
}

describe('when resolving an observable through two generic base classes', () => {
    let item: string;
    let observable: boolean;
    beforeEach(() => {
        const { checker, node, type } = fixture('leaf');
        const result = queryResult(type, checker, node);
        observable = result.observable;
        item = checker.typeToString(result.type);
    });
    it('should classify the result as observable', () => { observable.should.equal(true); });
    it('should resolve the concrete item type', () => { item.should.equal('string[]'); });
});

describe('when resolving an observable with a nested unbound type parameter', () => {
    let failure: Error | undefined;
    beforeEach(() => {
        const { checker, node, type } = fixture('wrapped');
        try { queryResult(type, checker, node); }
        catch (error) { failure = error as Error; }
    });
    it('should require an explicit Observable return annotation', () => {
        (failure instanceof Error).should.equal(true);
        failure!.message.should.include('annotate the return as Observable<...>');
    });
});
