// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import * as ts from 'typescript';
import { typesFor } from './bindingTypes.js';
import { decorated, memberName, tsImported } from './syntax.js';

/** External handlers cannot substitute for a command's own handle method. */
export const arc0003 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Put command handling on the command itself' }, messages: { external: 'Move handling of command {{command}} from {{handler}} to the command class.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { MethodDefinition(node) {
            if (node.static || memberName(node) !== 'handle' || node.parent?.parent?.type !== AST_NODE_TYPES.ClassDeclaration || decorated(context, node.parent.parent, 'command')) return;
            const parameter = node.value.params[0];
            if (!parameter) return;
            const types = typesFor(context);
            if (!types) return;
            const { checker, node: tsNode } = types;
            const symbol = checker.getTypeAtLocation(tsNode(parameter)).getSymbol();
            if (symbol?.declarations?.some(declaration => ts.isClassDeclaration(declaration) && ts.getDecorators(declaration)?.some(decorator =>
                ts.isCallExpression(decorator.expression) && tsImported(checker, decorator.expression.expression, '@cratis/arc.core', 'command')))) {
                context.report({ node: node.key, messageId: 'external', data: { command: symbol?.name ?? '<unknown>', handler: node.parent.parent.id?.name ?? '<anonymous>' } });
            }
        } };
    }
});
