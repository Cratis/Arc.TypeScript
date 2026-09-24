// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { RecordedRule } from './RecordedRule.js';

const arity = new Map<string, number>([
    ['notNull', 0], ['notEmpty', 0], ['emailAddress', 0], ['phone', 0], ['url', 0],
    ['minLength', 1], ['maxLength', 1], ['length', 2], ['matches', 1],
    ['greaterThan', 1], ['greaterThanOrEqual', 1], ['lessThan', 1], ['lessThanOrEqual', 1]
]);
export function renderRecordedRules(name: string, base: 'CommandValidator' | 'QueryValidator', target: string,
    rules: readonly RecordedRule[], diagnostic: (message: string) => void): string {
    const lines: string[] = [];
    for (const rule of rules) {
        if (!rule.clientSafe || rule.path.length !== 1 || !arity.has(rule.kind) || rule.args.length !== arity.get(rule.kind) ||
            rule.args.some(arg => rule.kind === 'matches' ? typeof arg !== 'string' : arity.get(rule.kind) !== 0 &&
                (typeof arg !== 'number' || !Number.isFinite(arg)))) {
            diagnostic(`Server-only validation rule on ${name}.${rule.path.join('.')}: ${rule.kind}`);
            continue;
        }
        if (rule.kind === 'matches') {
            try { new RegExp(rule.args[0] as string); }
            catch { diagnostic(`Unsupported validation argument on ${name}.${rule.path.join('.')}: matches`); continue; }
        }
        const argument = rule.kind === 'matches' ?
            `/${(rule.args[0] as string || '(?:)').replaceAll('/', '\\/').replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')}/` :
            rule.args.map(arg => typeof arg === 'number' ? String(arg) : JSON.stringify(arg)).join(', ');
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(rule.path[0]!)) {
            diagnostic(`Unsupported validation argument on ${name}.${rule.path.join('.')}: ${rule.kind}`);
            continue;
        }
        const message = rule.message?.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n').replaceAll('\r', '\\r');
        lines.push(`        this.ruleFor(c => c.${rule.path[0]}).${rule.kind}(${argument})${message === undefined ? '' : `.withMessage('${message}')`};`);
    }
    if (!lines.length) return '';
    return `export class ${name}Validator extends ${base}<${target}> {\n    constructor() {\n        super();\n${lines.join('\n')}\n    }\n}\n\n`;
}
