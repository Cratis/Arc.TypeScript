// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ESLintUtils } from '@typescript-eslint/utils';
import { decorated, memberName } from './syntax.js';

/** Detect decorators the Arc compiler cannot apply at their declaration site. */
export const misplacedDecorator = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Place Arc decorators on supported artifacts' }, messages: { misplaced: '@{{decorator}} has no effect on this declaration.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { ClassDeclaration(node) {
            for (const member of node.body.body) {
                if (member.type !== 'MethodDefinition') {
                    if (member.type === 'StaticBlock' || member.type === 'TSIndexSignature') continue;
                    for (const name of ['query', 'inject', 'authorize', 'allowAnonymous', 'roles']) {
                        if (decorated(member, name)) context.report({ node: member, messageId: 'misplaced', data: { decorator: name } });
                    }
                    continue;
                }
                const name = memberName(member);
                for (const decorator of ['query', 'inject', 'authorize', 'allowAnonymous', 'roles']) {
                    if (!decorated(member, decorator)) continue;
                    const valid = decorator === 'query' ? decorated(node, 'readModel') && member.static :
                        decorator === 'inject' ? decorated(node, 'command') && !member.static && name === 'handle' :
                            decorated(node, 'readModel') && member.static && decorated(member, 'query');
                    if (!valid) context.report({ node: member.key, messageId: 'misplaced', data: { decorator } });
                }
            }
        } };
    }
});
