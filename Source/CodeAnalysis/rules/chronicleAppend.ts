// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

/** Identify a direct append to the default log, not a read or an append to another sequence. */
export function defaultLogAppend(node: TSESTree.CallExpression): boolean {
    const callee = node.callee;
    if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.computed ||
        callee.property.type !== AST_NODE_TYPES.Identifier || !['append', 'appendMany'].includes(callee.property.name)) return false;
    const log = callee.object;
    return log.type === AST_NODE_TYPES.MemberExpression && !log.computed &&
        log.property.type === AST_NODE_TYPES.Identifier && log.property.name === 'eventLog' &&
        (log.object.type === AST_NODE_TYPES.Identifier || log.object.type === AST_NODE_TYPES.MemberExpression &&
            log.object.object.type === AST_NODE_TYPES.ThisExpression);
}

/** Find the enclosing method and its class, stopping at nested functions and classes. */
/** Limit diagnostics to stores owned by the artifact, not independently selected stores. */
export function ownStore(context: TSESLint.RuleContext<string, readonly unknown[]>, node: TSESTree.CallExpression): boolean {
    if (!defaultLogAppend(node) || node.callee.type !== AST_NODE_TYPES.MemberExpression ||
        node.callee.object.type !== AST_NODE_TYPES.MemberExpression) return false;
    const receiver = node.callee.object.object;
    if (receiver.type === AST_NODE_TYPES.MemberExpression) return receiver.object.type === AST_NODE_TYPES.ThisExpression;
    if (receiver.type !== AST_NODE_TYPES.Identifier) return false;
    let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(receiver);
    while (scope) {
        const variable = scope.set.get(receiver.name);
        if (variable) return variable.defs.some(definition => {
            if (definition.node.type !== AST_NODE_TYPES.VariableDeclarator) return false;
            const initializer = definition.node.init;
            const call = initializer?.type === AST_NODE_TYPES.AwaitExpression ? initializer.argument : initializer;
            return call?.type === AST_NODE_TYPES.CallExpression && call.callee.type === AST_NODE_TYPES.MemberExpression &&
                !call.callee.computed && call.callee.property.type === AST_NODE_TYPES.Identifier &&
                call.callee.property.name === 'getStore' && call.callee.object.type === AST_NODE_TYPES.MemberExpression &&
                call.callee.object.object.type === AST_NODE_TYPES.ThisExpression;
        });
        scope = scope.upper;
    }
    return false;
}

export function enclosingMethod(node: TSESTree.Node): { method: TSESTree.MethodDefinition; owner: TSESTree.ClassDeclaration } | undefined {
    let parent: TSESTree.Node | undefined = node.parent;
    while (parent) {
        if (parent.type === AST_NODE_TYPES.ArrowFunctionExpression || parent.type === AST_NODE_TYPES.FunctionDeclaration ||
            parent.type === AST_NODE_TYPES.ClassDeclaration || parent.type === AST_NODE_TYPES.FunctionExpression &&
            parent.parent?.type !== AST_NODE_TYPES.MethodDefinition) return undefined;
        if (parent.type === AST_NODE_TYPES.MethodDefinition) {
            const owner = parent.parent?.parent;
            return owner?.type === AST_NODE_TYPES.ClassDeclaration ? { method: parent, owner } : undefined;
        }
        parent = parent.parent;
    }
    return undefined;
}
