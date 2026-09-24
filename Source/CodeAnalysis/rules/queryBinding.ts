// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import { typesFor, tokenMatches } from './bindingTypes.js';
import { decoration, imported } from './syntax.js';

/** Check explicit query descriptors against runtime-counted method parameters. */
export const queryBinding = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Align @query descriptors and method parameters' }, messages: {
        count: '@query descriptors for {{name}} must match the runtime method parameter count.',
        type: 'Query binding token {{token}} cannot produce parameter {{parameter}}.'
    }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { MethodDefinition(node) {
            const call = decoration(context, node, 'query');
            if (!call) return;
            const descriptors = call.arguments[0]?.type === AST_NODE_TYPES.ObjectExpression ? call.arguments.slice(1) : call.arguments;
            // Bare @query() can use legacy emitted type metadata.
            if (!descriptors.length) return;
            const count = node.value.params.findIndex(parameter => parameter.type === AST_NODE_TYPES.AssignmentPattern || parameter.type === AST_NODE_TYPES.RestElement);
            if (descriptors.length !== (count < 0 ? node.value.params.length : count)) {
                context.report({ node: call, messageId: 'count', data: { name: context.sourceCode.getText(node.key) } });
                return;
            }
            const types = typesFor(context);
            if (!types) return;
            const { checker, node: tsNode } = types;
            descriptors.forEach((descriptor, index) => {
                const parameter = node.value.params[index];
                if (!parameter || descriptor.type !== AST_NODE_TYPES.CallExpression) return;
                const isArgument = imported(context, descriptor.callee, '@cratis/arc.core', 'argument');
                const isService = imported(context, descriptor.callee, '@cratis/arc.core', 'service');
                const token = isArgument ? descriptor.arguments[1] : isService ? descriptor.arguments[0] : undefined;
                if (token && token.type !== AST_NODE_TYPES.SpreadElement && !tokenMatches(checker, tsNode(token), tsNode(parameter))) {
                    context.report({ node: descriptor, messageId: 'type', data: { token: context.sourceCode.getText(token), parameter: context.sourceCode.getText(parameter) } });
                }
            });
        } };
    }
});
