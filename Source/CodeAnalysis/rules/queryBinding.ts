// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import { typesFor, tokenMatches } from './bindingTypes.js';
import { decoration } from './syntax.js';

/** Check explicit query descriptors against declared method parameters. */
export const queryBinding = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Align @query descriptors and method parameters' }, messages: {
        count: '@query descriptors must match the method parameter count.',
        name: 'Query argument name must match its parameter name.',
        type: 'Query binding token cannot produce the declared parameter type.'
    }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { MethodDefinition(node) {
            const call = decoration(node, 'query');
            if (!call) return;
            const descriptors = call.arguments[0]?.type === AST_NODE_TYPES.ObjectExpression ? call.arguments.slice(1) : call.arguments;
            // Bare @query() can use legacy emitted type metadata.
            if (!descriptors.length) return;
            if (descriptors.length !== node.value.params.length) {
                context.report({ node: call, messageId: 'count' });
                return;
            }
            const { checker, node: tsNode } = typesFor(context);
            descriptors.forEach((descriptor, index) => {
                const parameter = node.value.params[index];
                if (!parameter || descriptor.type !== AST_NODE_TYPES.CallExpression || descriptor.callee.type !== AST_NODE_TYPES.Identifier) return;
                if (descriptor.callee.name === 'argument' && descriptor.arguments[0]?.type === AST_NODE_TYPES.Literal && parameter.type === AST_NODE_TYPES.Identifier &&
                    descriptor.arguments[0].value !== parameter.name) context.report({ node: descriptor, messageId: 'name' });
                const token = descriptor.callee.name === 'argument' ? descriptor.arguments[1] : descriptor.callee.name === 'service' ? descriptor.arguments[0] : undefined;
                if (token && token.type !== AST_NODE_TYPES.SpreadElement && !tokenMatches(checker, tsNode(token), tsNode(parameter))) {
                    context.report({ node: descriptor, messageId: 'type' });
                }
            });
        } };
    }
});
