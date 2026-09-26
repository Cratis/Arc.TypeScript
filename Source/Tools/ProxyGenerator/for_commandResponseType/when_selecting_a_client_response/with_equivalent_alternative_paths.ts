// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import ts from 'typescript';
import { analyzeSource } from '../../analyzeSource.js';
import { describeCommandResponse } from '../../commandResponseType.js';
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';
import { sourceProgram } from '../../sourceProgram.js';

const root = resolve(import.meta.dirname, '../given');

describe('when analyzing alternative command paths', () => {
    let analysis: ReturnType<typeof analyzeSource>;
    beforeEach(() => { analysis = analyzeSource(resolve(root, 'tsconfig.json'), resolve(root, 'Features')); });

    it('should retain one DTO for an alias and an unwrapped path', () => {
        analysis.operations.find(item => item.name === 'AliasedResponse')!.result.text.should.equal('Plain');
    });
    it('should await a promise path before comparing decoders', () => {
        analysis.operations.find(item => item.name === 'AwaitedAlternative')!.result.text.should.equal('Plain');
    });
    it('should distinguish tuple members from alternative paths', () => {
        for (const name of ['TupleAlternatives', 'NestedTupleAlternative'])
            analysis.operations.find(item => item.name === name)!.result.text.should.equal('Plain', name);
    });
    it('should preserve array cardinality across paths', () => {
        analysis.operations.find(item => item.name === 'ArrayAlternatives')!.result.text.should.equal('Plain[]');
    });
    it('should retain a primitive result across wrapped and unwrapped paths', () => {
        analysis.operations.find(item => item.name === 'SamePrimitivePaths')!.result.text.should.equal('string');
    });
    it('should use the same selected decoder in generated runtime metadata', () => {
        const metadata = renderGeneratedMetadata(resolve(root, 'tsconfig.json'), resolve(root, 'Features'), resolve(root, 'generatedMetadata.ts'));
        metadata.should.match(/handleResult: \{ cardinality: 'many', nullable: false, element: _arc\d+ \}/);
    });
});

describe('when inspecting alternative command paths', () => {
    const examine = (name: string) => {
        const program = sourceProgram(resolve(root, 'tsconfig.json'));
        const checker = program.getTypeChecker();
        const file = program.getSourceFile(resolve(root, 'Features/Responses.ts'))!;
        const method = file.statements.filter(ts.isClassDeclaration).find(owner => owner.name?.text === name)!
            .members.find(ts.isMethodDeclaration)!;
        return describeCommandResponse(checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(method)!), checker, method);
    };
    it('should keep distinct tuple alternatives with one simultaneous response each', () => {
        const descriptor = examine('TupleAlternatives');
        descriptor.paths.filter(path => path.response).should.have.lengthOf(2);
        descriptor.paths.every(path => path.members.length <= 1).should.equal(true);
    });
    it('should not treat a nested tuple as alternative simultaneous client responses', () => {
        const descriptor = examine('NestedTupleAlternative');
        descriptor.paths.filter(path => path.response).should.have.lengthOf(2);
        descriptor.paths.every(path => path.members.length <= 1).should.equal(true);
    });
});
