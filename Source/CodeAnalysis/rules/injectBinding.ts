// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import { typesFor, tokenMatches } from './bindingTypes.js';
import { decoration, memberName } from './syntax.js';

/** Check class-valued @inject tokens with the TypeScript checker. */
export const injectBinding = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Align @inject tokens with handle parameters' }, messages: {
        count: '@inject token count must match handle parameters (except a single implicit provided value).',
        type: '@inject token cannot produce the declared parameter type.'
    }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { MethodDefinition(node) {
            if (memberName(node) !== 'handle') return;
            const call = decoration(node, 'inject');
            if (!call) return;
            if (call.arguments.length !== node.value.params.length && call.arguments.length + 1 !== node.value.params.length) {
                context.report({ node: call, messageId: 'count' }); return;
            }
            const { checker, node: tsNode } = typesFor(context);
            const offset = node.value.params.length - call.arguments.length;
            call.arguments.forEach((token, index) => {
                if (token.type === AST_NODE_TYPES.SpreadElement) return;
                const parameter = node.value.params[index + offset];
                if (parameter && !tokenMatches(checker, tsNode(token), tsNode(parameter))) context.report({ node: token, messageId: 'type' });
            });
        } };
    }
});
