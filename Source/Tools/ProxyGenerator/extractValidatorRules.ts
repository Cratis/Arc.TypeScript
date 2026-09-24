// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import type { RecordedRule } from './RecordedRule.js';

const portable = new Map<string, number>([
    ['notNull', 0], ['notEmpty', 0], ['emailAddress', 0], ['phone', 0], ['url', 0],
    ['minLength', 1], ['maxLength', 1], ['length', 2], ['matches', 1],
    ['greaterThan', 1], ['greaterThanOrEqual', 1], ['lessThan', 1], ['lessThanOrEqual', 1]
]);
export interface ValidatorRules {
    readonly target: ts.Symbol;
    readonly rules: readonly RecordedRule[];
    readonly diagnostics: readonly string[];
}
function name(expression: ts.Expression): string | undefined {
    return ts.isPropertyAccessExpression(expression) ? expression.name.text : undefined;
}
function literal(expression: ts.Expression): string | number | undefined {
    if (ts.isStringLiteral(expression)) return expression.text;
    if (ts.isNumericLiteral(expression)) return Number(expression.text);
    if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(expression.operand))
        return -Number(expression.operand.text);
    if (ts.isRegularExpressionLiteral(expression)) {
        const source = expression.text;
        const slash = source.lastIndexOf('/');
        return slash > 0 && !source.slice(slash + 1) ? source.slice(1, slash).replaceAll('\\/', '/') : undefined;
    }
    return undefined;
}
function selectedPath(call: ts.CallExpression): string[] | undefined {
    if (!ts.isPropertyAccessExpression(call.expression) || call.expression.expression.kind !== ts.SyntaxKind.ThisKeyword || call.expression.name.text !== 'ruleFor') return undefined;
    const selector = call.arguments[0];
    if (!selector || !ts.isArrowFunction(selector) || selector.parameters.length !== 1 || !ts.isIdentifier(selector.parameters[0]!.name)) return undefined;
    const path: string[] = [];
    let current: ts.Expression = selector.body as ts.Expression;
    while (ts.isPropertyAccessExpression(current)) { path.unshift(current.name.text); current = current.expression; }
    return ts.isIdentifier(current) && current.text === selector.parameters[0]!.name.text && path.length ? path : undefined;
}
function chain(expression: ts.Expression): { path?: string[]; calls: ts.CallExpression[] } {
    const calls: ts.CallExpression[] = [];
    let current = expression;
    while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
        if (current.expression.name.text === 'ruleFor') return { path: selectedPath(current), calls: calls.reverse() };
        calls.push(current);
        current = current.expression.expression;
    }
    return { calls: calls.reverse() };
}
/** Extract only literal, unconditional constructor rules; never execute application code to obtain them. */
export function extractValidatorRules(declaration: ts.ClassDeclaration, target: ts.Symbol): ValidatorRules {
    const rules: RecordedRule[] = [];
    const diagnostics: string[] = [];
    const constructor = declaration.members.find(ts.isConstructorDeclaration);
    if (!constructor?.body) return { target, rules, diagnostics };
    for (const statement of constructor.body.statements) {
        if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) &&
            statement.expression.expression.kind === ts.SyntaxKind.SuperKeyword) continue;
        const result = ts.isExpressionStatement(statement) ? chain(statement.expression) : { calls: [] };
        if (!result.path || !result.calls.length) {
            diagnostics.push(`${declaration.getSourceFile().fileName}:${declaration.getSourceFile().getLineAndCharacterOfPosition(statement.getStart()).line + 1}: Server-only validator statement`);
            continue;
        }
        const statementRules: RecordedRule[] = [];
        let safe = true;
        for (const call of result.calls) {
            const kind = name(call.expression) ?? 'unknown';
            if (kind === 'withMessage' && statementRules.length) {
                const message = call.arguments[0] && literal(call.arguments[0]);
                if (typeof message !== 'string') safe = false;
                else statementRules[statementRules.length - 1] = { ...statementRules[statementRules.length - 1]!, message };
                continue;
            }
            if (!portable.has(kind)) { safe = false; continue; }
            const args = call.arguments.map(literal);
            if (args.length !== portable.get(kind) || args.some(arg => arg === undefined) ||
                args.some(arg => kind === 'matches' ? typeof arg !== 'string' : portable.get(kind) !== 0 &&
                    (typeof arg !== 'number' || !Number.isFinite(arg)))) safe = false;
            statementRules.push({ path: result.path, kind, args: args.filter(arg => arg !== undefined) as (string | number)[], clientSafe: true });
        }
        for (const rule of statementRules) rules.push({ ...rule, clientSafe: safe });
        if (!safe || !statementRules.length) diagnostics.push(`${declaration.getSourceFile().fileName}:${declaration.getSourceFile().getLineAndCharacterOfPosition(statement.getStart()).line + 1}: Server-only validator rule on ${result.path.join('.')}`);
    }
    return { target, rules, diagnostics };
}
