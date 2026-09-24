// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ESLintUtils } from '@typescript-eslint/utils';
import { decorated, memberName } from './syntax.js';

/** Properties without @field are invisible to model binding. */
export const missingField = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Decorate model-bound properties with @field' }, messages: { missing: 'Property {{name}} needs @field(...) to participate in model binding.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { ClassDeclaration(node) {
            if (!decorated(context, node, 'command') && !decorated(context, node, 'readModel')) return;
            for (const member of node.body.body) {
                if (member.type === 'PropertyDefinition' && !member.static && !member.declare && member.accessibility !== 'private' && member.key.type !== 'PrivateIdentifier' &&
                    !decorated(context, member, 'field') && !memberName(member)?.startsWith('_')) {
                    context.report({ node: member.key, messageId: 'missing', data: { name: memberName(member) ?? 'computed' } });
                }
            }
        } };
    }
});
