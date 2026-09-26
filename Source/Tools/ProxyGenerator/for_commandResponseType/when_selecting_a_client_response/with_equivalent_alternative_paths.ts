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
    let metadata: string;
    beforeEach(() => {
        analysis = analyzeSource(resolve(root, 'tsconfig.json'), resolve(root, 'Features'));
        metadata = renderGeneratedMetadata(resolve(root, 'tsconfig.json'), resolve(root, 'Features'), resolve(root, 'generatedMetadata.ts'));
    });
    const verify = (name: string, proxy: string, shape: string | RegExp, nullable = false) => {
        analysis.operations.find(item => item.name === name)!.result.text.should.equal(proxy, name);
        const entry = metadata.split('\n').find(line => line.includes(`\\"name\\":\\"${name}\\"`))!;
        if (typeof shape === 'string') entry.should.contain(`handleResult: { cardinality: 'one', nullable: ${nullable}, element: ${shape} }`);
        else {
            entry.should.match(shape);
            const alias = /handleResult: \{[^}]*element: (_arc\d+) \}/.exec(entry)![1];
            const model = proxy.replace(/\[\]$/, '');
            metadata.should.contain(`import { ${model} as ${alias} }`);
        }
        return entry;
    };

    it('should retain one DTO for an alias and an unwrapped path', () => {
        verify('AliasedResponse', 'Plain', /handleResult: \{ cardinality: 'one', nullable: false, element: _arc\d+ \}/);
    });
    it('should await a promise path before comparing decoders', () => {
        verify('AwaitedAlternative', 'Plain', /handleResult: \{ cardinality: 'one', nullable: false, element: _arc\d+ \}/);
    });
    it('should distinguish tuple members from alternative paths', () => {
        for (const name of ['TupleAlternatives', 'NestedTupleAlternative'])
            verify(name, 'Plain', /handleResult: \{ cardinality: 'one', nullable: false, element: _arc\d+ \}/);
    });
    it('should preserve array cardinality across paths', () => {
        verify('ArrayAlternatives', 'Plain[]', /handleResult: \{ cardinality: 'many', nullable: false, element: _arc\d+ \}/);
    });
    it('should retain a primitive result across wrapped and unwrapped paths', () => {
        verify('SamePrimitivePaths', 'string', 'String');
    });
    it('should retain boolean as a full union rather than the first literal', () => {
        const entry = verify('BooleanResult', 'boolean', 'Boolean');
        entry.should.not.contain('handleValueResult:');
    });
    it('should retain an enum as a full union', () => {
        const entry = verify('ColorResult', 'Color', 'Number');
        entry.should.not.contain('handleValueResult:');
    });
    it('should retain a string literal union', () => {
        const entry = verify('LiteralResult', '"created" | "existing"', 'String');
        entry.should.not.contain('handleValueResult:');
    });
    it('should retain an optional boolean and its nullability', () => {
        verify('OptionalBooleanResult', 'boolean', 'Boolean', true);
    });
    it('should retain a boolean union with void as nullable', () => {
        verify('VoidBooleanResult', 'boolean', 'Boolean', true);
    });
    it('should retain a nullable enum and its nullability', () => {
        verify('NullableColorResult', 'Color', 'Number', true);
    });
    it('should retain an optional string literal union and its nullability', () => {
        verify('OptionalLiteralResult', '"created" | "existing"', 'String', true);
    });
    it('should retain the full boolean in an Outcome', () => {
        verify('WrappedBooleanResult', 'boolean', 'Boolean').should.contain("handleValueResult: { cardinality: 'void', nullable: true }");
    });
    it('should use the shared primitive for distinct concepts', () => {
        verify('DistinctConcepts', 'string', 'String').should.not.match(/handleResult: \{[^}]*element: _arc\d+/);
    });
    it('should use the shared primitive for arrays of distinct concepts', () => {
        analysis.operations.find(item => item.name === 'DistinctConceptArrays')!.result.text.should.equal('string[]');
        const entry = metadata.split('\n').find(line => line.includes('\\"name\\":\\"DistinctConceptArrays\\"'))!;
        entry.should.contain("handleResult: { cardinality: 'many', nullable: false, element: String }");
        entry.should.not.match(/handleResult: \{[^}]*element: _arc\d+/);
    });
    it('should not treat a user DTO named Date as the standard Date', () => {
        verify('NamedDate', 'Date', /handleResult: \{ cardinality: 'one', nullable: false, element: _arc\d+ \}/);
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
