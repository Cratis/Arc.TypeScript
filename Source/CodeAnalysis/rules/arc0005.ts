// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import { decorated, method } from './syntax.js';

/** Flag a prepared value when handle cannot receive it. */
export const arc0005 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Consume values produced by provide()' }, messages: { unused: 'provide() returns a value but handle() has no binding for it.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { ClassDeclaration(node) {
            if (!decorated(node, 'command')) return;
            const provider = method(node, 'provide');
            const handler = method(node, 'handle');
            if (!provider?.value.body || !handler || handler.value.params.length) return;
            if (provider.value.body.body.some(statement => statement.type === AST_NODE_TYPES.ReturnStatement && statement.argument &&
                !(statement.argument.type === AST_NODE_TYPES.Identifier && ['undefined'].includes(statement.argument.name)) &&
                !(statement.argument.type === AST_NODE_TYPES.CallExpression && statement.argument.callee.type === AST_NODE_TYPES.Identifier && ['rejected', 'denied'].includes(statement.argument.callee.name)))) {
                context.report({ node: provider.key, messageId: 'unused' });
            }
        } };
    }
});
