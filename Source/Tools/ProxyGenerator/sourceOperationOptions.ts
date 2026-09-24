// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { QueryHttpMethod } from '@cratis/arc.core';
import { isPackageSymbol } from './sourceSymbols.js';

function value(expression: ts.Expression | undefined, name: string): ts.Expression | undefined {
    if (!expression || !ts.isCallExpression(expression) || !expression.arguments[0] ||
        !ts.isObjectLiteralExpression(expression.arguments[0])) return undefined;
    const property = expression.arguments[0].properties.find(item => ts.isPropertyAssignment(item) && item.name.getText() === name);
    return property && ts.isPropertyAssignment(property) ? property.initializer : undefined;
}
/** Read static decorator options; a dynamic value cannot be safely copied to a client proxy. */
export function warningOption(expression: ts.Expression | undefined): boolean | undefined {
    const option = value(expression, 'treatWarningsAsErrors');
    if (!option) return undefined;
    if (option.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (option.kind === ts.SyntaxKind.FalseKeyword) return false;
    throw new Error(`${option.getSourceFile().fileName}: treatWarningsAsErrors must be a boolean literal`);
}
/** Read a QueryHttpMethod enum member from @cratis/arc.core. */
export function httpMethodOption(expression: ts.Expression | undefined, checker: ts.TypeChecker): QueryHttpMethod | undefined {
    const option = value(expression, 'httpMethod');
    if (!option) return undefined;
    if (ts.isPropertyAccessExpression(option) && isPackageSymbol(checker, option.expression, 'QueryHttpMethod', '@cratis/arc.core') &&
        Object.hasOwn(QueryHttpMethod, option.name.text)) return QueryHttpMethod[option.name.text as keyof typeof QueryHttpMethod];
    throw new Error(`${option.getSourceFile().fileName}: httpMethod must be a QueryHttpMethod enum member`);
}
