// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import ts from 'typescript';
import { commandResponseType } from '../../commandResponseType.js';
import { sourceProgram } from '../../sourceProgram.js';

const root = resolve(import.meta.dirname, '../given');

describe('when selecting a command client response with arrays of outcomes', () => {
    let errors: string[];
    beforeEach(() => {
        const program = sourceProgram(resolve(root, 'tsconfig.json'));
        const checker = program.getTypeChecker();
        const file = program.getSourceFile(resolve(root, 'Features/given/InvalidOutcomeArrays.ts'))!;
        errors = file.statements.filter(ts.isClassDeclaration).map(owner => {
            const method = owner.members.find(ts.isMethodDeclaration)!;
            const result = checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(method)!);
            try { commandResponseType(result, checker, method); return ''; }
            catch (failure) { return (failure as Error).message; }
        });
    });
    it('should reject arrays of event outcomes', () => {
        errors[0]!.should.contain('not an array of Outcome values');
    });
    it('should reject arrays of string outcomes', () => {
        errors[1]!.should.contain('not an array of Outcome values');
    });
});
