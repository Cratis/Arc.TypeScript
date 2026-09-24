// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import * as ts from 'typescript';

export type RuleContext = TSESLint.RuleContext<string, readonly unknown[]>;

/** Resolve an imported name through its lexical binding, never through its spelling. */
export function imported(context: RuleContext, node: TSESTree.Node, source: string, name: string): boolean {
    if (node.type === AST_NODE_TYPES.MemberExpression && !node.computed && node.property.type === AST_NODE_TYPES.Identifier && node.property.name === name) {
        return node.object.type === AST_NODE_TYPES.Identifier && importedBinding(context, node.object, source, '*');
    }
    return node.type === AST_NODE_TYPES.Identifier && importedBinding(context, node, source, name);
}

function importedBinding(context: RuleContext, node: TSESTree.Identifier, source: string, name: string): boolean {
    let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(node);
    while (scope) {
        const variable = scope.set.get(node.name);
        if (variable) {
            const definition = variable.defs[0];
            if (definition?.type !== 'ImportBinding') return false;
            const declaration = definition.parent;
            if (declaration.type !== AST_NODE_TYPES.ImportDeclaration || declaration.source.value !== source) return false;
            const specifier = definition.node;
            return name === '*' ? specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier :
                specifier.type === AST_NODE_TYPES.ImportSpecifier && (specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : specifier.imported.value) === name;
        }
        scope = scope.upper;
    }
    return false;
}

/** Resolve TypeScript decorator bindings even when the decorated class is in another file. */
export function tsImported(checker: ts.TypeChecker, expression: ts.Expression, source: string, name: string): boolean {
    const reference = ts.isPropertyAccessExpression(expression) ? expression.expression : expression;
    const symbol = checker.getSymbolAtLocation(reference);
    if (!symbol) return false;
    return symbol.declarations?.some(declaration => {
        const specifier = ts.isImportSpecifier(declaration) ? declaration :
            ts.isNamespaceImport(declaration) ? declaration : undefined;
        if (!specifier) return false;
        const clause = specifier.parent;
        const importDeclaration = ts.isImportClause(clause) ? clause.parent : clause.parent.parent;
        if (!ts.isImportDeclaration(importDeclaration) || !ts.isStringLiteral(importDeclaration.moduleSpecifier) ||
            importDeclaration.moduleSpecifier.text !== source) return false;
        return ts.isNamespaceImport(specifier) ? ts.isPropertyAccessExpression(expression) && expression.name.text === name :
            ts.isIdentifier(expression) && (specifier.propertyName?.text ?? specifier.name.text) === name;
    }) ?? false;
}

/** Return the decorator call from the expected package, excluding unrelated bindings. */
export function decoration(context: RuleContext, node: { decorators?: TSESTree.Decorator[] }, name: string): TSESTree.CallExpression | undefined {
    const expression = node.decorators?.find(decorator => decorator.expression.type === AST_NODE_TYPES.CallExpression &&
        imported(context, decorator.expression.callee, '@cratis/arc.core', name))?.expression;
    return expression?.type === AST_NODE_TYPES.CallExpression ? expression : undefined;
}

/** Check a decorator from Arc (including a bare decorator). */
export function decorated(context: RuleContext, node: { decorators?: TSESTree.Decorator[] }, name: string): boolean {
    return !!node.decorators?.some(decorator => imported(context,
        decorator.expression.type === AST_NODE_TYPES.CallExpression ? decorator.expression.callee : decorator.expression,
        name === 'field' ? '@cratis/fundamentals' : '@cratis/arc.core', name));
}

/** Find an inherited callable instance method when a program is available. */
export function inheritedMethod(context: RuleContext, node: TSESTree.ClassDeclaration, name: string): boolean {
    const services = ESLintUtils.getParserServices(context, true);
    if (!services.program) {
        if (node.superClass?.type !== AST_NODE_TYPES.Identifier) return false;
        let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(node.superClass);
        while (scope) {
            const variable = scope.set.get(node.superClass.name);
            if (variable) return variable.defs.some(definition => definition.node.type === AST_NODE_TYPES.ClassDeclaration &&
                !!method(definition.node, name) || definition.node.type === AST_NODE_TYPES.ClassDeclaration &&
                inheritedMethod(context, definition.node, name));
            scope = scope.upper;
        }
        return false;
    }
    const checker = services.program.getTypeChecker();
    const declaration = services.esTreeNodeToTSNodeMap.get(node);
    const type = checker.getTypeAtLocation(declaration);
    return checker.getPropertyOfType(type, name)?.declarations?.some(member =>
        ts.isMethodDeclaration(member) && !member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword) &&
        member.parent !== declaration) ?? false;
}

/** Resolve a statically spelled member name. */
export function memberName(node: { key: TSESTree.Expression | TSESTree.PrivateIdentifier }): string | undefined {
    return node.key.type === AST_NODE_TYPES.Identifier ? node.key.name : undefined;
}

/** Find a named method declared directly on a class. */
export function method(node: TSESTree.ClassDeclaration, name: string): TSESTree.MethodDefinition | undefined {
    return node.body.body.find(member => member.type === AST_NODE_TYPES.MethodDefinition && memberName(member) === name) as TSESTree.MethodDefinition | undefined;
}
