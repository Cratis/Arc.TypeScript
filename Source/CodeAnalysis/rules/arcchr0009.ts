// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { decorated, imported } from './syntax.js';

// These names are already withheld by runChronicleCommand; report only the remaining .NET words.
const runtimeMasked = /password|secret|token|credential|apiKey/i;
const sensitive = new Set(['passphrase', 'accesskey', 'privatekey', 'pin', 'otp', 'cvv', 'cvc', 'securitycode', 'authorizationheader']);

function readsAsUnmaskedSecret(name: string): boolean {
    if (runtimeMasked.test(name)) return false;
    const words = name.match(/[A-Z]+(?=[A-Z][a-z]|[^a-zA-Z]|$)|[A-Z]?[a-z]+|[0-9]+/g)?.map(word => word.toLowerCase()) ?? [];
    return words.some((word, index) => sensitive.has(word) || index + 1 < words.length && sensitive.has(word + words[index + 1]));
}

/** Find secret-looking command fields that Chronicle does not already mask from causation. */
export const arcchr0009 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Mark secret-looking command fields as not audited' },
        messages: { secret: "Command '{{command}}' carries '{{property}}', whose name reads as a secret, and its value will be written to the causation of every event the command appends. Mark it [NotAudited], or [PII] if it is personal data." }, schema: [] },
    defaultOptions: [],
    create(context) {
        const marked = (node: { decorators?: TSESTree.Decorator[] }): boolean => node.decorators?.some(decorator => {
            const expression = decorator.expression.type === AST_NODE_TYPES.CallExpression ? decorator.expression.callee : decorator.expression;
            return imported(context, expression, '@cratis/arc.chronicle', 'notAudited') ||
                imported(context, expression, '@cratis/chronicle/compliance', 'pii') ||
                imported(context, expression, '@cratis/chronicle', 'pii');
        }) ?? false;
        return { ClassDeclaration(node) {
            if (!node.id || !decorated(context, node, 'command') || marked(node)) return;
            for (const member of node.body.body) {
                if (member.type !== AST_NODE_TYPES.PropertyDefinition || member.static ||
                    member.key.type !== AST_NODE_TYPES.Identifier || marked(member) ||
                    member.value?.type === AST_NODE_TYPES.Literal && typeof member.value.value !== 'string' ||
                    !readsAsUnmaskedSecret(member.key.name)) continue;
                context.report({ node: member.key, messageId: 'secret', data: { command: node.id.name, property: member.key.name } });
            }
        } };
    }
});
