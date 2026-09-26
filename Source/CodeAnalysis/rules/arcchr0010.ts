// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { decorated, imported, method, tsImported } from './syntax.js';
import { typesFor } from './bindingTypes.js';
import * as ts from 'typescript';

/** Warn when a keyless command returns a Guid response beside a bare Chronicle event. */
export const arcchr0010 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Raw Guid response does not set the event source id' },
        messages: { guid: "Keyless command '{{name}}' returns a raw Guid beside event '{{event}}'. " +
            'The Guid is an ordinary response, not event-source metadata. If it identifies the event source, ' +
            "return eventSourceIdResponse(id) or declare the command's event source id." }, schema: [] },
    defaultOptions: [],
    create(context) {
        const eventName = (node: TSESTree.Node): string | undefined => {
            if (node.type !== AST_NODE_TYPES.NewExpression || node.callee.type !== AST_NODE_TYPES.Identifier) return undefined;
            const types = typesFor(context);
            if (!types) return undefined;
            const type = types.checker.getTypeAtLocation(types.node(node));
            const declared = type.getSymbol()?.declarations?.some(declaration => ts.isClassDeclaration(declaration) &&
                ts.canHaveDecorators(declaration) && ts.getDecorators(declaration)?.some(decorator =>
                    ts.isCallExpression(decorator.expression) &&
                    tsImported(types.checker, decorator.expression.expression, '@cratis/chronicle/events', 'eventType')));
            return declared ? node.callee.name : undefined;
        };
        return { ClassDeclaration(node) {
            if (!node.id || !decorated(context, node, 'command') || node.superClass ||
                method(node, 'getEventSourceId') || method(node, 'getKey') ||
                node.body.body.some(member => member.type === AST_NODE_TYPES.PropertyDefinition &&
                    (decorated(context, member, 'key') || member.key.type === AST_NODE_TYPES.Identifier &&
                        ['getKey', 'getEventSourceId'].includes(member.key.name)))) return;
            const handle = method(node, 'handle');
            if (!handle) return;
            const visit = (part: TSESTree.Node): void => {
                if (part.type === AST_NODE_TYPES.ReturnStatement && part.argument?.type === AST_NODE_TYPES.CallExpression &&
                    imported(context, part.argument.callee, '@cratis/arc.core', 'tuple')) {
                    const args = part.argument.arguments;
                    if (args.some(arg => arg.type === AST_NODE_TYPES.CallExpression &&
                        imported(context, arg.callee, '@cratis/arc.chronicle', 'eventSourceIdResponse'))) return;
                    const guid = args.find(arg => arg.type === AST_NODE_TYPES.CallExpression &&
                        arg.callee.type === AST_NODE_TYPES.MemberExpression && !arg.callee.computed &&
                        arg.callee.property.type === AST_NODE_TYPES.Identifier && arg.callee.property.name === 'parse' &&
                        imported(context, arg.callee.object, '@cratis/fundamentals', 'Guid'));
                    const event = args.map(eventName).find(Boolean);
                    if (guid && event) context.report({ node: guid, messageId: 'guid', data: { name: node.id!.name, event } });
                }
                if (part.type === AST_NODE_TYPES.BlockStatement) part.body.forEach(visit);
                else if (part.type === AST_NODE_TYPES.IfStatement) {
                    visit(part.consequent);
                    if (part.alternate) visit(part.alternate);
                }
            };
            if (handle.value.body) visit(handle.value.body);
        } };
    }
});
