// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** Return the decorator call, excluding unrelated decorators and bare identifiers. */
export function decoration(node: { decorators?: TSESTree.Decorator[] }, name: string): TSESTree.CallExpression | undefined {
    const expression = node.decorators?.find(decorator => decorator.expression.type === AST_NODE_TYPES.CallExpression &&
        decorator.expression.callee.type === AST_NODE_TYPES.Identifier && decorator.expression.callee.name === name)?.expression;
    return expression?.type === AST_NODE_TYPES.CallExpression ? expression : undefined;
}

/** Check whether the declaration has a decorator (including a bare decorator). */
export function decorated(node: { decorators?: TSESTree.Decorator[] }, name: string): boolean {
    return !!node.decorators?.some(decorator => decorator.expression.type === AST_NODE_TYPES.Identifier && decorator.expression.name === name ||
        decorator.expression.type === AST_NODE_TYPES.CallExpression && decorator.expression.callee.type === AST_NODE_TYPES.Identifier && decorator.expression.callee.name === name);
}

/** Resolve a statically spelled member name. */
export function memberName(node: { key: TSESTree.Expression | TSESTree.PrivateIdentifier }): string | undefined {
    return node.key.type === AST_NODE_TYPES.Identifier ? node.key.name : undefined;
}

/** Find a named method declared directly on a class. */
export function method(node: TSESTree.ClassDeclaration, name: string): TSESTree.MethodDefinition | undefined {
    return node.body.body.find(member => member.type === AST_NODE_TYPES.MethodDefinition && memberName(member) === name) as TSESTree.MethodDefinition | undefined;
}

/** Identify a constructor-like class token without guessing about factories. */
export function tokenName(node: TSESTree.Node | undefined): string | undefined {
    return node?.type === AST_NODE_TYPES.Identifier ? node.name : undefined;
}
