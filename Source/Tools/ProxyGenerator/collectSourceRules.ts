// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import type { ValidatorRules } from './extractValidatorRules.js';
import type { RecordedRule } from './RecordedRule.js';
import type { SourceOperation } from './SourceOperation.js';

/** Map validator rules to bound client fields, reporting server-only rules. */
export function collectSourceRules(targets: ReadonlyMap<string, ts.Symbol>,
    concepts: ReadonlyMap<string, { name: string; symbol: ts.Symbol }[]>, validators: readonly ValidatorRules[],
    operations: readonly SourceOperation[], diagnostics: string[]): Map<string, readonly RecordedRule[]> {
    const recordedRules = new Map<string, readonly RecordedRule[]>();
    for (const [key, target] of targets) {
        const direct = validators.filter(item => item.target === target);
        const inherited = (concepts.get(key) ?? []).flatMap(field => validators.filter(item => item.target === field.symbol).flatMap(item =>
            item.rules.filter(rule => rule.path.length === 1 && rule.path[0] === 'value').map(rule => ({ ...rule, path: [field.name] }))));
        const rules = [...direct.flatMap(item => item.rules), ...inherited];
        const fields = operations.find(operation => [operation.namespace, operation.owner,
            ...(operation.kind === 'command' ? [] : [operation.name])].filter(Boolean).join('.') === key)?.fields ?? [];
        for (const rule of rules) if (rule.clientSafe && (rule.path.length !== 1 || !fields.some(field => field.name === rule.path[0])))
            diagnostics.push(`Server-only validation rule on ${key}.${rule.path.join('.')}: path is not a @field or bound argument`);
        const valid = rules.filter(rule => rule.clientSafe && rule.path.length === 1 && fields.some(field => field.name === rule.path[0]));
        if (valid.length) recordedRules.set(key, valid);
    }
    // Source-only predicates and conditional rules cannot be represented by the browser validator.
    for (const validator of validators) diagnostics.push(...validator.diagnostics);
    return recordedRules;
}
