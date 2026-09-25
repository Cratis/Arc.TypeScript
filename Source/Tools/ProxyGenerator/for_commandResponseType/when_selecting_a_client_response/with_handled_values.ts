// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import ts from 'typescript';
import { given } from '../../given.js';
import { analyzeSource } from '../../analyzeSource.js';
import { commandResponseType } from '../../commandResponseType.js';
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';
import { renderSource } from '../../renderSource.js';
import { sourceProgram } from '../../sourceProgram.js';

class response_declarations {
    readonly root = resolve(import.meta.dirname, '../given');
    readonly project = resolve(this.root, 'tsconfig.json');
    readonly artifacts = resolve(this.root, 'Features');
}

describe('when selecting a command client response', given(response_declarations, context => {
    it('should omit handled values without creating client event models', () => {
        const analysis = analyzeSource(context.project, context.artifacts);
        for (const name of ['JustEvent', 'AsyncEvents', 'JustOperation', 'Operation', 'Routed', 'Scoped', 'Committed', 'EventOrNothing'])
            analysis.operations.find(item => item.name === name)!.result.void.should.equal(true, name);
        analysis.models.map(item => item.name).should.not.include('Registered');
        const proxy = renderSource(analysis).get('JustEvent.ts')!;
        proxy.should.contain('extends Command<IJustEvent>');
        proxy.should.contain('super(Object, false)');
    });
    it('should select the visible value from tuples, unions and id responses', () => {
        const analysis = analyzeSource(context.project, context.artifacts);
        for (const name of ['WithId', 'WithResponse', 'EventOrResponse'])
            analysis.operations.find(item => item.name === name)!.result.text.should.equal('string', name);
        analysis.operations.find(item => item.name === 'PlainResult')!.result.text.should.equal('Plain');
        analysis.operations.find(item => item.name === 'PlainArray')!.result.text.should.equal('string[]');
    });
    it('should describe the client response and retain the raw handle shape for runtime validation', () => {
        const metadata = renderGeneratedMetadata(context.project, context.artifacts, resolve(context.root, 'generatedMetadata.ts'));
        metadata.should.contain("handleResult: { cardinality: 'void', nullable: false }, handleValueResult: { cardinality: 'one', nullable: false }");
        metadata.should.contain("handleResult: { cardinality: 'one', nullable: false, element: String }, handleValueResult:");
    });
    it('should reject ambiguous tuples and bare operation arrays at their declarations', () => {
        const program = sourceProgram(context.project);
        const checker = program.getTypeChecker();
        const file = program.getSourceFile(resolve(context.artifacts, 'given/Invalid.ts'))!;
        const methods = file.statements.filter(ts.isClassDeclaration).filter(owner => ['TooMany', 'BareOperations'].includes(owner.name!.text))
            .map(owner => owner.members.find(ts.isMethodDeclaration)!);
        const returns = methods.map(method => checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(method)!));
        (() => commandResponseType(returns[0]!, checker, methods[0]!)).should.throw('Multiple unhandled command response values');
        (() => commandResponseType(returns[1]!, checker, methods[1]!)).should.throw('Use CommandOperations');
    });
}));
