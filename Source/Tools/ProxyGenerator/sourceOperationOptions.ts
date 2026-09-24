// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { QueryHttpMethod } from '@cratis/arc.core';
import { isPackageSymbol } from './sourceSymbols.js';

function value(expression: ts.Expression | undefined, name: string, checker?: ts.TypeChecker): ts.Expression | undefined {
    if (!expression || !ts.isCallExpression(expression) || !expression.arguments[0]) return undefined;
    const options = expression.arguments[0];
    // A query may start with a known parameter-binding call rather than an options object.
    if (ts.isCallExpression(options) && checker && ['argument', 'service', 'queryOptions'].some(binding =>
        isPackageSymbol(checker, options.expression, binding, '@cratis/arc.core'))) return undefined;
    if (!ts.isObjectLiteralExpression(options) || options.properties.some(item => !ts.isPropertyAssignment(item)))
        throw new Error(`${options.getSourceFile().fileName}: decorator options must be a static object with property assignments`);
    for (const item of options.properties) {
        const property = item as ts.PropertyAssignment;
        const key = property.name.getText();
        if (key === 'namespace' && !ts.isStringLiteral(property.initializer) ||
            key === 'observable' && property.initializer.kind !== ts.SyntaxKind.TrueKeyword && property.initializer.kind !== ts.SyntaxKind.FalseKeyword)
            throw new Error(`${property.getSourceFile().fileName}: ${key} must be a static literal`);
    }
    const property = options.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText() === name);
    return property && ts.isPropertyAssignment(property) ? property.initializer : undefined;
}
/** Read static decorator options; a dynamic value cannot be safely copied to a client proxy. */
export function warningOption(expression: ts.Expression | undefined, checker?: ts.TypeChecker): boolean | undefined {
    const option = value(expression, 'treatWarningsAsErrors', checker);
    if (!option) return undefined;
    if (option.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (option.kind === ts.SyntaxKind.FalseKeyword) return false;
    throw new Error(`${option.getSourceFile().fileName}: treatWarningsAsErrors must be a boolean literal`);
}
/** Read a QueryHttpMethod enum member from @cratis/arc.core. */
export function httpMethodOption(expression: ts.Expression | undefined, checker: ts.TypeChecker): QueryHttpMethod | undefined {
    const option = value(expression, 'httpMethod', checker);
    if (!option) return undefined;
    if (ts.isPropertyAccessExpression(option) && isPackageSymbol(checker, option.expression, 'QueryHttpMethod', '@cratis/arc.core') &&
        Object.hasOwn(QueryHttpMethod, option.name.text)) return QueryHttpMethod[option.name.text as keyof typeof QueryHttpMethod];
    throw new Error(`${option.getSourceFile().fileName}: httpMethod must be a QueryHttpMethod enum member`);
}
