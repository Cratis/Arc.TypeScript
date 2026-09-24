// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ESLintUtils } from '@typescript-eslint/utils';
import { decorated, method } from './syntax.js';

/** Find handler-shaped classes not registered as commands. */
export const arc0002 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'A command-like class needs @command()' }, messages: { missing: 'Class with handle() is missing @command().' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { ClassDeclaration(node) {
            if (method(node, 'handle') && !decorated(node, 'command') && !decorated(node, 'readModel') && node.id) {
                context.report({ node: node.id, messageId: 'missing' });
            }
        } };
    }
});
