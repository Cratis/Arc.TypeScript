// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { imported } from './syntax.js';

type RuleContext = TSESLint.RuleContext<string, readonly unknown[]>;

/** Identify a direct append to the default log, optionally through its transactional facade. */
export function defaultLogAppend(node: TSESTree.CallExpression): TSESTree.Expression | undefined {
    const callee = node.callee;
    if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.computed ||
        callee.property.type !== AST_NODE_TYPES.Identifier || !['append', 'appendMany'].includes(callee.property.name)) return undefined;
    let log: TSESTree.Expression = callee.object;
    if (log.type === AST_NODE_TYPES.MemberExpression && !log.computed &&
        log.property.type === AST_NODE_TYPES.Identifier && log.property.name === 'transactional') log = log.object;
    return log.type === AST_NODE_TYPES.MemberExpression && !log.computed &&
        log.property.type === AST_NODE_TYPES.Identifier && log.property.name === 'eventLog' ? log.object : undefined;
}

function getStoreReceiver(value: TSESTree.Expression): TSESTree.Expression | undefined {
    const call = value.type === AST_NODE_TYPES.AwaitExpression ? value.argument : value;
    return call.type === AST_NODE_TYPES.CallExpression && call.callee.type === AST_NODE_TYPES.MemberExpression &&
        !call.callee.computed && call.callee.property.type === AST_NODE_TYPES.Identifier &&
        call.callee.property.name === 'getStore' ? call.callee.object : undefined;
}

function injectedParameter(context: RuleContext, node: TSESTree.Identifier): boolean {
    const enclosing = enclosingMethod(node);
    if (!enclosing) return false;
    const index = enclosing.method.value.params.findIndex(param => param.type === AST_NODE_TYPES.Identifier && param.name === node.name);
    if (index < 0) return false;
    return enclosing.method.decorators?.some(decorator => {
        const expression = decorator.expression;
        if (expression.type !== AST_NODE_TYPES.CallExpression ||
            !imported(context, expression.callee, '@cratis/arc.core', 'inject')) return false;
        const token = expression.arguments[index];
        return !!token && ['ChronicleReadModels', 'ChronicleRuntime'].some(name =>
            imported(context, token, '@cratis/arc.chronicle', name));
    }) ?? false;
}

/** Limit command diagnostics to stores obtained from an artifact field or an injected Chronicle service. */
export function ownStore(context: RuleContext, node: TSESTree.CallExpression): boolean {
    const receiver = defaultLogAppend(node);
    if (!receiver) return false;
    const owned = (value: TSESTree.Expression): boolean => {
        if (value.type === AST_NODE_TYPES.MemberExpression) return value.object.type === AST_NODE_TYPES.ThisExpression;
        if (value.type !== AST_NODE_TYPES.Identifier) return false;
        let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(value);
        while (scope) {
            const variable = scope.set.get(value.name);
            if (variable) return variable.defs.some(definition => definition.node.type === AST_NODE_TYPES.VariableDeclarator &&
                !!definition.node.init && !!getStoreReceiver(definition.node.init) &&
                owned(getStoreReceiver(definition.node.init)!)) ||
                variable.defs.some(definition => definition.type === 'Parameter') && injectedParameter(context, value);
            scope = scope.upper;
        }
        return false;
    };
    return owned(receiver) || !!getStoreReceiver(receiver) && owned(getStoreReceiver(receiver)!);
}

/** Only fields explicitly initialized from this reactor's client/runtime count as candidate own stores. */
export function reactorStore(context: RuleContext, node: TSESTree.CallExpression): boolean {
    const receiver = defaultLogAppend(node);
    const enclosing = enclosingMethod(node);
    if (!enclosing || receiver?.type !== AST_NODE_TYPES.MemberExpression || receiver.computed ||
        receiver.object.type !== AST_NODE_TYPES.ThisExpression || receiver.property.type !== AST_NODE_TYPES.Identifier) return false;
    const name = receiver.property.name;
    const fromOwnClient = (value: TSESTree.Expression): boolean => {
        const call = value.type === AST_NODE_TYPES.AwaitExpression ? value.argument : value;
        return call.type === AST_NODE_TYPES.CallExpression && call.callee.type === AST_NODE_TYPES.MemberExpression &&
            !call.callee.computed && call.callee.property.type === AST_NODE_TYPES.Identifier &&
            ['getStore', 'getEventStore'].includes(call.callee.property.name) &&
            call.callee.object.type === AST_NODE_TYPES.MemberExpression &&
            call.callee.object.object.type === AST_NODE_TYPES.ThisExpression &&
            call.callee.object.property.type === AST_NODE_TYPES.Identifier &&
            ['client', 'runtime'].includes(call.callee.object.property.name);
    };
    const initializedField = enclosing.owner.body.body.some(member => member.type === AST_NODE_TYPES.PropertyDefinition &&
        member.key.type === AST_NODE_TYPES.Identifier && member.key.name === name &&
        !!member.value && fromOwnClient(member.value));
    const assignedInMethod = enclosing.method.value.body?.body.some(statement => statement.range[1] < node.range[0] &&
        statement.type === AST_NODE_TYPES.ExpressionStatement &&
        statement.expression.type === AST_NODE_TYPES.AssignmentExpression &&
        statement.expression.left.type === AST_NODE_TYPES.MemberExpression &&
        statement.expression.left.object.type === AST_NODE_TYPES.ThisExpression &&
        statement.expression.left.property.type === AST_NODE_TYPES.Identifier &&
        statement.expression.left.property.name === name &&
        fromOwnClient(statement.expression.right));
    return initializedField || !!assignedInMethod;
}

/** Find the enclosing method and its class, stopping at nested functions and classes. */
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
