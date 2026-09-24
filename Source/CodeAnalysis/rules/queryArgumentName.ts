// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import { decoration, imported } from './syntax.js';

/** Optional naming convention; Arc itself binds by position, not by local name. */
export const queryArgumentName = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'suggestion', docs: { description: 'Match query wire names to local parameter names' }, messages: {
        name: 'Query wire argument {{wire}} differs from parameter {{parameter}}.'
    }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { MethodDefinition(node) {
            const call = decoration(context, node, 'query');
            if (!call) return;
            const descriptors = call.arguments[0]?.type === AST_NODE_TYPES.ObjectExpression ? call.arguments.slice(1) : call.arguments;
            descriptors.forEach((descriptor, index) => {
                const parameter = node.value.params[index];
                if (descriptor.type !== AST_NODE_TYPES.CallExpression || !imported(context, descriptor.callee, '@cratis/arc.core', 'argument') ||
                    descriptor.arguments[0]?.type !== AST_NODE_TYPES.Literal || typeof descriptor.arguments[0].value !== 'string' ||
                    parameter?.type !== AST_NODE_TYPES.Identifier || descriptor.arguments[0].value === parameter.name) return;
                context.report({ node: descriptor, messageId: 'name', data: { wire: descriptor.arguments[0].value, parameter: parameter.name } });
            });
        } };
    }
});
