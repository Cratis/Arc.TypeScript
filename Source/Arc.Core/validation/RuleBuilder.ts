// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Severity } from './Severity.js';
import type { Rule } from './Rule.js';

export class RuleBuilder<T, V> {
    constructor(readonly path: readonly string[], private readonly append: (rule: Rule) => void,
        private readonly replace: (rule: Rule, replacement: Rule) => void,
        private readonly ignore: (name: string) => void) {}
    private last?: Rule;
    private add(kind: string, args: readonly unknown[] = [], safe = true): this {
        if (['minLength', 'maxLength', 'length'].includes(kind) && args.some(value => !Number.isSafeInteger(value) || (value as number) < 0) ||
            ['length', 'inclusiveBetween', 'exclusiveBetween'].includes(kind) && (args[0] as number) > (args[1] as number))
            throw new Error(`Invalid validation rule arguments: ${kind}`);
        const rule: Rule = Object.freeze({ path: Object.freeze([...this.path]), kind, args: Object.freeze([...args]), severity: Severity.Error, clientSafe: safe });
        this.append(rule);
        this.last = rule;
        return this;
    }
    private change(values: Partial<Rule>): this {
        if (!this.last) throw new Error('A rule is required before its options');
        const next = Object.freeze({ ...this.last, ...values });
        this.replace(this.last, next);
        this.last = next;
        return this;
    }
    notNull(): this { return this.add('notNull'); }
    notEmpty(): this { return this.add('notEmpty'); }
    minLength(length: number): this { return this.add('minLength', [length]); }
    maxLength(length: number): this { return this.add('maxLength', [length]); }
    length(min: number, max: number): this { return this.add('length', [min, max]); }
    emailAddress(): this { return this.add('emailAddress'); }
    phone(): this { return this.add('phone'); }
    url(): this { return this.add('url'); }
    matches(pattern: RegExp, errorMessage?: string): this {
        this.add('matches', [pattern], !pattern.global && !pattern.sticky && !pattern.flags);
        return errorMessage === undefined ? this : this.withMessage(errorMessage);
    }
    greaterThan(value: number): this { return this.add('greaterThan', [value], Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER); }
    greaterThanOrEqual(value: number): this { return this.add('greaterThanOrEqual', [value], Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER); }
    lessThan(value: number): this { return this.add('lessThan', [value], Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER); }
    lessThanOrEqual(value: number): this { return this.add('lessThanOrEqual', [value], Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER); }
    empty(): this { return this.add('empty', [], false); }
    null(): this { return this.add('null', [], false); }
    equal(value: V): this { return this.add('equal', [value], false); }
    notEqual(value: V): this { return this.add('notEqual', [value], false); }
    inclusiveBetween(min: number, max: number): this { return this.add('inclusiveBetween', [min, max], false); }
    exclusiveBetween(min: number, max: number): this { return this.add('exclusiveBetween', [min, max], false); }
    must(predicate: (value: V, model: T, signal: AbortSignal) => boolean): this { return this.add('must', [predicate], false); }
    mustAsync(predicate: (value: V, model: T, signal: AbortSignal) => Promise<boolean>): this { return this.add('mustAsync', [predicate], false); }
    when(predicate: (model: T) => boolean | Promise<boolean>): this { return this.change({ condition: predicate as Rule['condition'], clientSafe: false }); }
    unless(predicate: (model: T) => boolean | Promise<boolean>): this {
        return this.when(async model => !await predicate(model));
    }
    withMessage(message: string | ((value: V, model: T) => string)): this {
        return this.change({ message: message as Rule['message'], clientSafe: this.last!.clientSafe && typeof message === 'string' });
    }
    withSeverity(severity: Severity): this { return this.change({ severity, clientSafe: this.last!.clientSafe && severity === Severity.Error }); }
    withState(state: unknown | ((model: T) => unknown)): this { return this.change({ state, clientSafe: false }); }
    ignoreConceptRules(): this {
        if (this.path.length !== 1) throw new Error('Only direct concept members can ignore concept rules');
        this.ignore(this.path[0]!);
        return this;
    }
}
