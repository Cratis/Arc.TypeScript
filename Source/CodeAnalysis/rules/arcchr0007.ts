// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import { ownStore, enclosingMethod } from './chronicleAppend.js';
import { decorated } from './syntax.js';

/** Flag immediate appends through a command handler's own event store. */
export const arcchr0007 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Command handler must not append directly to the event log' },
        messages: { append: "Command '{{name}}' appends to the default event log in '{{method}}'. " +
            'Express every append through the handler return type, not the event log.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { CallExpression(node) {
            if (!ownStore(context, node)) return;
            const enclosing = enclosingMethod(node);
            if (!enclosing?.owner.id || enclosing.method.key.type !== AST_NODE_TYPES.Identifier ||
                !['handle', 'provide'].includes(enclosing.method.key.name) || !decorated(context, enclosing.owner, 'command')) return;
            context.report({ node, messageId: 'append', data: { name: enclosing.owner.id.name, method: enclosing.method.key.name } });
        } };
    }
});
