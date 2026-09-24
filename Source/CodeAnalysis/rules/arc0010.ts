// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ESLintUtils } from '@typescript-eslint/utils';
import { decorated, memberName } from './syntax.js';

/** Report async handlers whose body has no await. */
export const arc0010 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'suggestion', docs: { description: 'Do not wrap synchronous command results in a Promise' }, messages: { unnecessary: 'handle() is async but does not await; return the value synchronously.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { ClassDeclaration(node) {
            if (!decorated(node, 'command')) return;
            for (const member of node.body.body) {
                if (member.type !== 'MethodDefinition' || memberName(member) !== 'handle' || !member.value.async) continue;
                let awaits = false;
                const visit = (value: object): void => {
                    if ('type' in value && value.type === 'AwaitExpression') { awaits = true; return; }
                    if ('type' in value && ['ArrowFunctionExpression', 'FunctionExpression'].includes(String(value.type)) && value !== member.value) return;
                    for (const [key, child] of Object.entries(value)) {
                        if (key === 'parent' || key === 'loc' || key === 'range' || !child) continue;
                        if (Array.isArray(child)) child.forEach(item => { if (item && typeof item === 'object') visit(item); });
                        else if (typeof child === 'object') visit(child);
                    }
                };
                if (member.value.body) visit(member.value.body);
                if (!awaits) context.report({ node: member.key, messageId: 'unnecessary' });
            }
        } };
    }
});
