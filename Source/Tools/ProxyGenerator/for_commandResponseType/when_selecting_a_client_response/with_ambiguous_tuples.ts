// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import ts from 'typescript';
import { commandResponseType } from '../../commandResponseType.js';
import { sourceProgram } from '../../sourceProgram.js';

const root = resolve(import.meta.dirname, '../given');

describe('when selecting a command client response with ambiguous tuples', () => {
    let error: unknown;
    beforeEach(() => {
        const program = sourceProgram(resolve(root, 'tsconfig.json'));
        const checker = program.getTypeChecker();
        const file = program.getSourceFile(resolve(root, 'Features/given/Invalid.ts'))!;
        const method = file.statements.filter(ts.isClassDeclaration).find(owner => owner.name!.text === 'TooMany')!.members.find(ts.isMethodDeclaration)!;
        const result = checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(method)!);
        try { commandResponseType(result, checker, method); }
        catch (failure) { error = failure; }
    });
    it('should reject ambiguous tuples at their declarations', () => {
        (error as Error).message.should.contain('Multiple unhandled command response values');
    });
});
