// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ESLintUtils } from '@typescript-eslint/utils';
import { decorated, method } from './syntax.js';

/** Commands require a public instance handler. */
export const arc0004 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'A command needs a public instance handle()' }, messages: { missing: '@command() requires a public instance handle() method.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { ClassDeclaration(node) {
            if (!decorated(node, 'command')) return;
            const handler = method(node, 'handle');
            if (!handler || handler.static || handler.accessibility === 'private' || handler.accessibility === 'protected') {
                context.report({ node: node.id ?? node, messageId: 'missing' });
            }
        } };
    }
});
