// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ESLintUtils } from '@typescript-eslint/utils';
import { decorated } from './syntax.js';

/** Reject contradictory authorization on the same declaration. */
export const arc0019 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Anonymous access conflicts with role or authenticated access' }, messages: { conflict: '@allowAnonymous conflicts with @roles or @authorize on this declaration.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return {
            ClassDeclaration(node) {
                if (decorated(node, 'allowAnonymous') && (decorated(node, 'roles') || decorated(node, 'authorize'))) context.report({ node: node.id ?? node, messageId: 'conflict' });
            },
            MethodDefinition(node) {
                if (decorated(node, 'allowAnonymous') && (decorated(node, 'roles') || decorated(node, 'authorize'))) context.report({ node: node.key, messageId: 'conflict' });
            }
        };
    }
});
