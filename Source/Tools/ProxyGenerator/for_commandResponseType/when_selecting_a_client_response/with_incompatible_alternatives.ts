// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import ts from 'typescript';
import { commandResponseType } from '../../commandResponseType.js';
import { sourceProgram } from '../../sourceProgram.js';

const root = resolve(import.meta.dirname, '../given');

describe('when comparing incompatible client alternatives', () => {
    const responseFor = (name: string) => {
        const program = sourceProgram(resolve(root, 'tsconfig.json'));
        const checker = program.getTypeChecker();
        const file = program.getSourceFile(resolve(root, 'Features/given/Invalid.ts'))!;
        const method = file.statements.filter(ts.isClassDeclaration).find(owner => owner.name?.text === name)!
            .members.find(ts.isMethodDeclaration)!;
        return { checker, selected: commandResponseType(checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(method)!), checker, method) };
    };
    const errorFor = (name: string): string => {
        try { responseFor(name); }
        catch (error) { return (error as Error).message; }
        return '';
    };
    it('should reject different DTO constructors even if their properties match', () => {
        errorFor('DifferentDecoders').should.contain('one response DTO with an application-owned status field');
    });
    it('should reject different array cardinalities', () => {
        errorFor('DifferentCardinality').should.contain('one response DTO with an application-owned status field');
    });
    it('should not treat a user class named Date as the standard Date', () => {
        errorFor('DifferentDates').should.contain('one response DTO with an application-owned status field');
    });
    it('should not unwrap a shape that only imitates an Outcome', () => {
        const { selected, checker } = responseFor('FakeOutcome');
        checker.typeToString(selected!).should.equal('{ kind: "response"; value: Created; }');
    });
});
