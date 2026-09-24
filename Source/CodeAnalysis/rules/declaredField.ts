// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ESLintUtils } from '@typescript-eslint/utils';
import { decorated } from './syntax.js';

/** Declare-only fields are not emitted and cannot carry decorator metadata. */
export const declaredField = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Decorated model fields must be emitted' }, messages: { declared: 'Decorated declare fields are erased; use a definite assignment field instead.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { PropertyDefinition(node) {
            if (node.declare && decorated(context, node, 'field')) context.report({ node: node.key, messageId: 'declared' });
        } };
    }
});
