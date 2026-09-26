// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import * as ts from 'typescript';
import { typesFor } from './bindingTypes.js';
import { imported, tsImported } from './syntax.js';

/** Warn when a reactor returns an Arc command without deciding what replay should do. */
export const arcchr0006 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Reactor returning commands needs a replay decision' },
        messages: { replay: 'Reactor handler {{handlers}} returns an Arc command, which replay will execute again. ' +
            'Mark the class or handler @onceOnly() to skip replay (not ordinary re-delivery), or declare an @replay() handler for the same event. ' +
            'Choose carefully: once-only skips replay and may not be appropriate for recurring events.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        const types = typesFor(context);
        if (!types) return {};
        const { checker } = types;
        const chronicleDecorator = (node: TSESTree.Node, name: string): boolean =>
            'decorators' in node && Array.isArray(node.decorators) && node.decorators.some(decorator => {
                const expression = decorator.expression.type === AST_NODE_TYPES.CallExpression ? decorator.expression.callee : decorator.expression;
                return imported(context, expression, '@cratis/chronicle/reactors', name) ||
                    imported(context, expression, '@cratis/chronicle', name);
            });
        const decoratedCommand = (value: ts.Type): boolean => {
            if (value.isUnion()) return value.types.some(decoratedCommand);
            const awaited = checker.getAwaitedType(value);
            if (awaited && awaited !== value) return decoratedCommand(awaited);
            if (checker.isArrayType(value) || checker.isTupleType(value)) {
                const element = checker.getIndexTypeOfType(value, ts.IndexKind.Number);
                return !!element && decoratedCommand(element);
            }
            return value.getSymbol()?.declarations?.some(declaration => ts.isClassDeclaration(declaration) &&
                ts.canHaveDecorators(declaration) && ts.getDecorators(declaration)?.some(decorator =>
                    ts.isCallExpression(decorator.expression) &&
                    tsImported(checker, decorator.expression.expression, '@cratis/arc.core', 'command'))) ?? false;
        };
        const eventSymbol = (method: TSESTree.MethodDefinition): ts.Symbol | undefined => {
            const parameter = method.value.params[0];
            if (!parameter || parameter.type !== AST_NODE_TYPES.Identifier || !parameter.typeAnnotation) return undefined;
            const symbol = checker.getTypeAtLocation(types.node(parameter.typeAnnotation.typeAnnotation)).getSymbol();
            if (!symbol?.declarations?.some(declaration => ts.isClassDeclaration(declaration) &&
                ts.canHaveDecorators(declaration) && ts.getDecorators(declaration)?.some(decorator =>
                    ts.isCallExpression(decorator.expression) &&
                    (tsImported(checker, decorator.expression.expression, '@cratis/chronicle/events', 'eventType') ||
                        tsImported(checker, decorator.expression.expression, '@cratis/chronicle', 'eventType'))))) return undefined;
            return symbol;
        };
        const replayEvent = (method: TSESTree.MethodDefinition, events: Map<string, ts.Symbol>): ts.Symbol | undefined => {
            const decorator = method.decorators?.find(item => {
                const expression = item.expression.type === AST_NODE_TYPES.CallExpression ? item.expression.callee : item.expression;
                return imported(context, expression, '@cratis/chronicle/reactors', 'replay') ||
                    imported(context, expression, '@cratis/chronicle', 'replay');
            });
            if (!decorator) return undefined;
            const expression = decorator.expression;
            if (expression.type === AST_NODE_TYPES.CallExpression && expression.arguments.length) {
                const target = expression.arguments[0];
                if (!target || target.type === AST_NODE_TYPES.SpreadElement) return undefined;
                const symbol = checker.getSymbolAtLocation(types.node(target));
                return symbol && (symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol);
            }
            const name = method.key.type === AST_NODE_TYPES.Identifier ? method.key.name : '';
            return name.startsWith('replay') ? events.get(name.slice('replay'.length)) : undefined;
        };
        return { ClassDeclaration(node) {
            if (!node.id || !chronicleDecorator(node, 'reactor') || chronicleDecorator(node, 'onceOnly')) return;
            const methods = node.body.body.filter((member): member is TSESTree.MethodDefinition =>
                member.type === AST_NODE_TYPES.MethodDefinition && !member.static && member.key.type === AST_NODE_TYPES.Identifier);
            const events = new Map<string, ts.Symbol>();
            for (const method of methods) {
                const event = eventSymbol(method);
                if (event) events.set(event.name, event);
            }
            const replayed = new Set(methods.map(method => replayEvent(method, events)).filter((event): event is ts.Symbol => !!event));
            const handlers = methods.filter(method => {
                const event = eventSymbol(method);
                if (!event || method.key.type !== AST_NODE_TYPES.Identifier ||
                    method.key.name !== event.name.charAt(0).toLowerCase() + event.name.slice(1) ||
                    chronicleDecorator(method, 'replay') || chronicleDecorator(method, 'onceOnly') || replayed.has(event)) return false;
                return true;
            });
            if (!handlers.length) return;
            const owner = types.node(node);
            const results = new Map<ts.MethodDeclaration, ts.ReturnStatement[]>();
            const calls = new Map<ts.MethodDeclaration, Set<ts.MethodDeclaration>>();
            for (const method of methods) {
                const declaration = types.node(method);
                if (!ts.isMethodDeclaration(declaration) || !declaration.body) continue;
                const returns: ts.ReturnStatement[] = [];
                const reached = new Set<ts.MethodDeclaration>();
                const visit = (part: ts.Node): void => {
                    if (part !== declaration.body && (ts.isClassLike(part) || ts.isFunctionLike(part))) return;
                    if (ts.isReturnStatement(part) && part.expression && decoratedCommand(checker.getTypeAtLocation(part.expression))) {
                        const expression = ts.isAwaitExpression(part.expression) ? part.expression.expression : part.expression;
                        const callee = ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) &&
                            expression.expression.expression.kind === ts.SyntaxKind.ThisKeyword ?
                            checker.getSymbolAtLocation(expression.expression.name) : undefined;
                        // The callee's return is reported at its own site, once for every reaching handler.
                        if (!callee?.declarations?.some(candidate => ts.isMethodDeclaration(candidate) && candidate.parent === owner)) returns.push(part);
                    }
                    if (ts.isCallExpression(part) && ts.isPropertyAccessExpression(part.expression) &&
                        part.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
                        const symbol = checker.getSymbolAtLocation(part.expression.name);
                        for (const candidate of symbol?.declarations ?? []) {
                            if (ts.isMethodDeclaration(candidate) && candidate.parent === owner) reached.add(candidate);
                        }
                    }
                    ts.forEachChild(part, visit);
                };
                visit(declaration.body);
                results.set(declaration, returns);
                calls.set(declaration, reached);
            }
            const reaches = (start: ts.MethodDeclaration, target: ts.MethodDeclaration, visited: Set<ts.MethodDeclaration>): boolean => {
                if (start === target) return true;
                if (visited.has(start)) return false;
                visited.add(start);
                return [...calls.get(start) ?? []].some(next => reaches(next, target, visited));
            };
            for (const [method, returns] of results) {
                if (!returns.length) continue;
                const undecided = handlers.filter(handler => reaches(types.node(handler) as ts.MethodDeclaration, method, new Set()))
                    .map(handler => handler.key.type === AST_NODE_TYPES.Identifier ? handler.key.name : '')
                    .sort();
                if (!undecided.length) continue;
                const names = undecided.map(name => `'${name}'`);
                const formatted = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
                for (const statement of returns) {
                    const location = types.estree(statement.expression!);
                    if (location) context.report({ node: location, messageId: 'replay', data: { handlers: formatted } });
                }
            }
        } };
    }
});
