// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { DateOnly, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import { ApplyConditionTo } from './ApplyConditionTo.js';
import { Severity } from './Severity.js';
import type { Rule } from './Rule.js';
import { compareValues } from './compareValues.js';

type Comparable = number | Date | DateOnly | TimeOnly | TimeSpan;

/** Build immutable validation rules for a selected model member. */
export class RuleBuilder<T, V> {
    constructor(readonly path: readonly string[], private readonly append: (rule: Rule) => void,
        private readonly replace: (rule: Rule, replacement: Rule) => void,
        private readonly ignore: (name: string) => void) {}
    private last?: Rule;
    private readonly chain: Rule[] = [];
    private add(kind: string, args: readonly unknown[] = [], safe = true): this {
        if (['minLength', 'maxLength', 'length'].includes(kind) &&
            args.some(value => !Number.isSafeInteger(value) || (value as number) < 0) ||
            ['length', 'inclusiveBetween', 'exclusiveBetween'].includes(kind) && (compareValues(args[0], args[1]) ?? 0) > 0)
            throw new Error(`Invalid validation rule arguments: ${kind}`);
        const rule: Rule = Object.freeze({ path: Object.freeze([...this.path]), kind,
            args: Object.freeze([...args]), severity: Severity.Error, clientSafe: safe });
        this.append(rule);
        this.chain.push(rule);
        this.last = rule;
        return this;
    }
    private change(values: Partial<Rule>): this {
        if (!this.last) throw new Error('A rule is required before its options');
        const next = Object.freeze({ ...this.last, ...values });
        this.replace(this.last, next);
        this.chain[this.chain.length - 1] = next;
        this.last = next;
        return this;
    }
    /** Require a non-null value. */
    notNull(): this { return this.add('notNull'); }
    /** Require a non-default value, including rejecting Guid.empty. */
    notEmpty(): this { return this.add('notEmpty'); }
    /** Set a minimum string length. */
    minLength(this: V extends string ? RuleBuilder<T, V> : never, length: number): RuleBuilder<T, V> {
        return this.add('minLength', [length]);
    }
    /** Set a maximum string length. */
    maxLength(this: V extends string ? RuleBuilder<T, V> : never, length: number): RuleBuilder<T, V> {
        return this.add('maxLength', [length]);
    }
    /** Bound the string length inclusively. */
    length(this: V extends string ? RuleBuilder<T, V> : never, min: number, max: number): RuleBuilder<T, V> {
        return this.add('length', [min, max]);
    }
    /** Require an email-shaped string. */
    emailAddress(this: V extends string ? RuleBuilder<T, V> : never): RuleBuilder<T, V> { return this.add('emailAddress'); }
    /** Require a phone-shaped string. */
    phone(this: V extends string ? RuleBuilder<T, V> : never): RuleBuilder<T, V> { return this.add('phone'); }
    /** Require an HTTP(S) URL-shaped string. */
    url(this: V extends string ? RuleBuilder<T, V> : never): RuleBuilder<T, V> { return this.add('url'); }
    /** Require a matching string; flagged regular expressions remain server-only. */
    matches(this: V extends string ? RuleBuilder<T, V> : never, pattern: RegExp, errorMessage?: string): RuleBuilder<T, V> {
        this.add('matches', [pattern], !pattern.global && !pattern.sticky && !pattern.flags);
        return errorMessage === undefined ? this : this.withMessage(errorMessage);
    }
    /** Require a value greater than the bound. */
    greaterThan(this: V extends Comparable ? RuleBuilder<T, V> : never, value: V): RuleBuilder<T, V> {
        return this.add('greaterThan', [value], safeNumber(value));
    }
    /** Require a value at least as large as the bound. */
    greaterThanOrEqual(this: V extends Comparable ? RuleBuilder<T, V> : never, value: V): RuleBuilder<T, V> {
        return this.add('greaterThanOrEqual', [value], safeNumber(value));
    }
    /** Require a value below the bound. */
    lessThan(this: V extends Comparable ? RuleBuilder<T, V> : never, value: V): RuleBuilder<T, V> {
        return this.add('lessThan', [value], safeNumber(value));
    }
    /** Require a value no greater than the bound. */
    lessThanOrEqual(this: V extends Comparable ? RuleBuilder<T, V> : never, value: V): RuleBuilder<T, V> {
        return this.add('lessThanOrEqual', [value], safeNumber(value));
    }
    /** Require the default or empty value. */
    empty(): this { return this.add('empty', [], false); }
    /** Require null. */
    null(): this { return this.add('null', [], false); }
    /** Compare by value for temporal and GUID values. */
    equal(value: V): this { return this.add('equal', [value], false); }
    /** Reject an equal value. */
    notEqual(value: V): this { return this.add('notEqual', [value], false); }
    /** Require a value within inclusive bounds. */
    inclusiveBetween(this: V extends Comparable ? RuleBuilder<T, V> : never, min: V, max: V): RuleBuilder<T, V> {
        return this.add('inclusiveBetween', [min, max], false);
    }
    /** Require a value strictly between bounds. */
    exclusiveBetween(this: V extends Comparable ? RuleBuilder<T, V> : never, min: V, max: V): RuleBuilder<T, V> {
        return this.add('exclusiveBetween', [min, max], false);
    }
    /** Evaluate a synchronous server-side predicate. */
    must(predicate: (value: V, model: T, signal: AbortSignal) => boolean): this { return this.add('must', [predicate], false); }
    /** Evaluate an asynchronous server-side predicate. */
    mustAsync(predicate: (value: V, model: T, signal: AbortSignal) => Promise<boolean>): this {
        return this.add('mustAsync', [predicate], false);
    }
    /** Apply a condition to all rules in this chain, or only the latest rule. */
    when(predicate: (model: T) => boolean | Promise<boolean>, applyTo = ApplyConditionTo.AllValidators): this {
        if (!this.last) throw new Error('A rule is required before its options');
        const selected = applyTo === ApplyConditionTo.CurrentValidator ? [this.chain.length - 1] : this.chain.map((_, index) => index);
        for (const index of selected) {
            const rule = this.chain[index]!;
            const condition = rule.condition;
            const next = Object.freeze({ ...rule, condition: condition ? async (model: unknown) =>
                await condition(model) && await predicate(model as T) : predicate as Rule['condition'], clientSafe: false });
            this.replace(rule, next);
            this.chain[index] = next;
        }
        this.last = this.chain[this.chain.length - 1];
        return this;
    }
    /** Apply the inverse of a condition using the same chain selection as when(). */
    unless(predicate: (model: T) => boolean | Promise<boolean>, applyTo = ApplyConditionTo.AllValidators): this {
        return this.when(async model => !await predicate(model), applyTo);
    }
    /** Supply a failure message for the latest rule. */
    withMessage(message: string | ((value: V, model: T) => string)): this {
        return this.change({ message: message as Rule['message'], clientSafe: this.last!.clientSafe && typeof message === 'string' });
    }
    /** Set the latest rule's failure severity. */
    withSeverity(severity: Severity): this {
        return this.change({ severity, clientSafe: this.last!.clientSafe && severity === Severity.Error });
    }
    /** Attach custom state to a failure from the latest rule. */
    withState(state: (model: T) => unknown): this;
    withState(state: unknown): this;
    withState(state: unknown): this { return this.change({ state, clientSafe: false }); }
    /** Skip the concept validator for this direct member only. */
    ignoreConceptRules(): this {
        if (this.path.length !== 1) throw new Error('Only direct concept members can ignore concept rules');
        this.ignore(this.path[0]!);
        return this;
    }
}

function safeNumber(value: unknown): boolean {
    return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
}
