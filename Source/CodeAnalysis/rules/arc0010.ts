// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { decorated, memberName } from './syntax.js';

/** Report async handlers that neither await nor return an existing promise. */
export const arc0010 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'suggestion', docs: { description: 'Do not wrap synchronous command results in a Promise' }, messages: { unnecessary: 'Command {{name}} has an async handle() without asynchronous work.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        const functions: TSESTree.Node[] = [];
        let handler: TSESTree.MethodDefinition | undefined;
        let asynchronous = false;
        return {
            'MethodDefinition, FunctionExpression, ArrowFunctionExpression, FunctionDeclaration'(node: TSESTree.Node) {
                functions.push(node);
                if (node.type === 'MethodDefinition' && memberName(node) === 'handle' && node.value.async &&
                    node.parent?.parent?.type === 'ClassDeclaration' && decorated(context, node.parent.parent, 'command')) {
                    handler = node;
                    asynchronous = false;
                }
            },
            AwaitExpression() { if (handler && functions.at(-1)?.type === 'FunctionExpression' && functions.at(-2) === handler) asynchronous = true; },
            'ForOfStatement[await=true]'() { if (handler && functions.at(-1)?.type === 'FunctionExpression' && functions.at(-2) === handler) asynchronous = true; },
            ReturnStatement(node) {
                if (handler && functions.at(-1)?.type === 'FunctionExpression' && functions.at(-2) === handler && node.argument &&
                    node.argument.type !== 'Literal' && !(node.argument.type === 'Identifier' && node.argument.name === 'undefined')) asynchronous = true;
            },
            'MethodDefinition:exit'(node: TSESTree.MethodDefinition) {
                if (handler === node) {
                    if (!asynchronous) context.report({ node: node.key, messageId: 'unnecessary', data: { name: node.parent?.parent?.type === 'ClassDeclaration' ? node.parent.parent.id?.name ?? '<anonymous>' : '<anonymous>' } });
                    handler = undefined;
                }
                functions.pop();
            },
            'FunctionExpression:exit'() { functions.pop(); },
            'ArrowFunctionExpression:exit'() { functions.pop(); },
            'FunctionDeclaration:exit'() { functions.pop(); }
        };
    }
});
