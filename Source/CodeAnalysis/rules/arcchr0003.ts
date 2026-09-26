// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import { reactorStore, enclosingMethod } from './chronicleAppend.js';
import { imported } from './syntax.js';

/** Reject direct appends to a reactor's own default event log. */
export const arcchr0003 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Reactor must not reach the default event log' },
        messages: { append: "Reactor '{{name}}' reaches the default event log through '{{access}}'. " +
            'Return events from the handler instead of appending directly.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { CallExpression(node) {
            if (!reactorStore(context, node)) return;
            const target = node.callee;
            if (target.type !== AST_NODE_TYPES.MemberExpression || target.object.type !== AST_NODE_TYPES.MemberExpression) return;
            const enclosing = enclosingMethod(node);
            if (!enclosing?.owner.id || !enclosing.owner.decorators?.some(decorator => imported(context,
                decorator.expression.type === AST_NODE_TYPES.CallExpression ? decorator.expression.callee : decorator.expression,
                '@cratis/chronicle/reactors', 'reactor') || imported(context,
                decorator.expression.type === AST_NODE_TYPES.CallExpression ? decorator.expression.callee : decorator.expression,
                '@cratis/chronicle', 'reactor'))) return;
            context.report({ node: target.object, messageId: 'append', data: { name: enclosing.owner.id.name,
                access: context.sourceCode.getText(target.object) } });
        } };
    }
});
