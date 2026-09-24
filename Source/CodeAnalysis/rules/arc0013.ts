// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import { isConcept } from './conceptTypes.js';
import { typesFor } from './bindingTypes.js';

/** A concept's value may be absent during model validation. */
export const arc0013 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Avoid dereferencing concept members in validator selectors' }, messages: { dereference: 'Validate the concept itself; dereferencing its member can throw before a rule runs.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { CallExpression(node) {
            if (node.callee.type !== AST_NODE_TYPES.MemberExpression || node.callee.property.type !== AST_NODE_TYPES.Identifier || node.callee.property.name !== 'ruleFor') return;
            const selector = node.arguments[0];
            if (selector?.type !== AST_NODE_TYPES.ArrowFunctionExpression || selector.body.type !== AST_NODE_TYPES.MemberExpression || selector.body.object.type !== AST_NODE_TYPES.MemberExpression) return;
            const { checker, node: tsNode } = typesFor(context);
            if (isConcept(checker, checker.getTypeAtLocation(tsNode(selector.body.object)))) context.report({ node: selector.body, messageId: 'dereference' });
        } };
    }
});
