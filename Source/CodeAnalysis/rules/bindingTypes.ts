// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ESLintUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import * as ts from 'typescript';

/** Obtain a compiler checker for rules which must prove a mismatch. */
export function typesFor(context: TSESLint.RuleContext<string, readonly unknown[]>): {
    checker: ts.TypeChecker;
    node: (node: TSESTree.Node) => ts.Node;
} {
    const services = ESLintUtils.getParserServices(context);
    return { checker: services.program.getTypeChecker(), node: value => services.esTreeNodeToTSNodeMap.get(value) };
}

/** Compare the instance represented by a constructor token with the parameter's type. */
export function tokenMatches(checker: ts.TypeChecker, token: ts.Node, parameter: ts.Node): boolean {
    const expected = checker.getTypeAtLocation(parameter);
    const constructor = checker.getTypeAtLocation(token);
    if (ts.isIdentifier(token) && ['String', 'Number', 'Boolean', 'Array'].includes(token.text)) {
        const signature = checker.getSignaturesOfType(constructor, ts.SignatureKind.Call)[0];
        return !signature || checker.isTypeAssignableTo(checker.getReturnTypeOfSignature(signature), expected);
    }
    const signature = checker.getSignaturesOfType(constructor, ts.SignatureKind.Construct)[0];
    if (!signature) return true; // A service token or an unresolvable declaration is not proof.
    const instance = checker.getReturnTypeOfSignature(signature);
    return checker.isTypeAssignableTo(instance, expected);
}
