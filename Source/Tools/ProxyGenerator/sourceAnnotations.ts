// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { fieldName, isPackageSymbol, originalSymbol } from './sourceSymbols.js';
import { SourceTypeResolver } from './SourceTypeResolver.js';
import type { SourceField } from './SourceField.js';

export function annotation(checker: ts.TypeChecker, node: ts.Node, name: string, owner: 'arc' | 'fundamentals' = 'arc'): ts.CallExpression | ts.Expression | undefined {
    for (const decorator of ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : []) {
        const expression = decorator.expression;
        const identifier = ts.isCallExpression(expression) ? expression.expression : expression;
        if (!ts.isIdentifier(identifier) && !ts.isPropertyAccessExpression(identifier)) continue;
        const symbol = ts.isPropertyAccessExpression(identifier) ? identifier.name : identifier;
        if (isPackageSymbol(checker, symbol, name, owner === 'arc' ? '@cratis/arc.core' : '@cratis/fundamentals'))
            return expression;
    }
    return undefined;
}
export function stringArgument(value: ts.Expression | undefined, key?: string): string | undefined {
    if (!value || !ts.isCallExpression(value)) return undefined;
    const selected = key && value.arguments[0] && ts.isObjectLiteralExpression(value.arguments[0]) ? value.arguments[0].properties.find(property =>
        ts.isPropertyAssignment(property) && property.name.getText() === key) : value.arguments[0];
    const argument = selected && ts.isPropertyAssignment(selected) ? selected.initializer : selected;
    return argument && ts.isStringLiteral(argument) ? argument.text : undefined;
}
export function roles(checker: ts.TypeChecker, node: ts.Node): string[] {
    const decorator = annotation(checker, node, 'roles');
    if (!decorator || !ts.isCallExpression(decorator)) return [];
    return decorator.arguments.map(argument => {
        if (!ts.isStringLiteral(argument)) throw new Error(`${argument.getSourceFile().fileName}: roles must be string literals`);
        return argument.text;
    });
}
export function classChain(declaration: ts.ClassDeclaration, checker: ts.TypeChecker): ts.ClassDeclaration[] {
    const chain: ts.ClassDeclaration[] = [];
    const visited = new Set<ts.Symbol>();
    let current: ts.ClassDeclaration | undefined = declaration;
    while (current) {
        chain.unshift(current);
        const type = checker.getTypeAtLocation(current);
        const base: ts.BaseType | undefined = type.getBaseTypes()?.[0];
        if (!base?.symbol || visited.has(base.symbol)) break;
        visited.add(base.symbol);
        current = base.symbol.declarations?.find(ts.isClassDeclaration);
    }
    return chain;
}
export function fieldsFor(declaration: ts.ClassDeclaration, checker: ts.TypeChecker, resolver: SourceTypeResolver,
    diagnostics: string[], generatedMetadata = false): SourceField[] {
    return classChain(declaration, checker).flatMap(owner => owner.members.filter(ts.isPropertyDeclaration))
        .filter(member => !!annotation(checker, member, 'field', 'fundamentals'))
        .map(member => {
            const name = fieldName(member.name);
            const hasDefault = !!annotation(checker, member, 'defaultValue') || generatedMetadata && !!member.initializer;
            const optional = !!annotation(checker, member, 'optional') || hasDefault || generatedMetadata && !!member.questionToken;
            const memberType = checker.getTypeAtLocation(member);
            const nullable = !!annotation(checker, member, 'nullable') || generatedMetadata && memberType.isUnion() &&
                memberType.types.some(part => !!(part.flags & ts.TypeFlags.Null));
            if (member.questionToken && !optional)
                throw new Error(`${member.getSourceFile().fileName}: ${name} TypeScript ? disagrees with Arc field optionality; add @optional() or remove ?`);
            if (!member.questionToken && optional)
                diagnostics.push(`${member.getSourceFile().fileName}: ${name} Arc field is optional but TypeScript property lacks ?`);
            const enumeration = annotation(checker, member, 'enumeration');
            const argument = enumeration && ts.isCallExpression(enumeration) ? enumeration.arguments[0] : undefined;
            const enumSymbol = argument && originalSymbol(checker, argument);
            const annotated = enumSymbol?.declarations?.some(ts.isEnumDeclaration);
            const type = annotated ? checker.getDeclaredTypeOfSymbol(enumSymbol!) : checker.getTypeAtLocation(member);
            return { name, type: resolver.resolve(type, member, nullable || optional), optional, nullable };
        });
}
