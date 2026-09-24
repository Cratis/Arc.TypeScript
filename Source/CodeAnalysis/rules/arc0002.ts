// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import * as ts from 'typescript';
import { typesFor } from './bindingTypes.js';
import { decorated, imported, memberName, method, tsImported } from './syntax.js';

/** Find handler-shaped classes not registered as commands, using the .NET command heuristic. */
export const arc0002 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'A command-like class needs @command()' }, messages: { missing: 'Class {{name}} looks like a command but is missing @command().' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { ClassDeclaration(node) {
            const handler = method(node, 'handle');
            if (!node.id || node.abstract || node.decorators?.some(decorator => decorator.expression.type === AST_NODE_TYPES.CallExpression &&
                decorator.expression.callee.type === AST_NODE_TYPES.Identifier && decorator.expression.callee.name === 'command' &&
                !imported(context, decorator.expression.callee, '@cratis/arc.core', 'command')) ||
                !handler || handler.static || handler.accessibility === 'private' ||
                node.id.name.endsWith('Extensions') || node.id.name.endsWith('Helper') ||
                node.implements?.some(implementation => implementation.expression.type === AST_NODE_TYPES.Identifier &&
                    ['ICommandHandler', 'ICommandResponseValueHandler'].includes(implementation.expression.name)) ||
                decorated(context, node, 'command') || decorated(context, node, 'readModel') ||
                !node.body.body.some(member => member.type === AST_NODE_TYPES.PropertyDefinition && !member.static &&
                    member.accessibility !== 'private' && member.accessibility !== 'protected' && memberName(member))) return;
            const types = typesFor(context);
            if (types && handler.value.params.some(parameter => {
                const symbol = types.checker.getTypeAtLocation(types.node(parameter)).getSymbol();
                return symbol?.declarations?.some(declaration => ts.isClassDeclaration(declaration) &&
                    ts.getDecorators(declaration)?.some(decorator => ts.isCallExpression(decorator.expression) &&
                        tsImported(types.checker, decorator.expression.expression, '@cratis/arc.core', 'command')));
            })) return;
            context.report({ node: node.id, messageId: 'missing', data: { name: node.id.name } });
        } };
    }
});
