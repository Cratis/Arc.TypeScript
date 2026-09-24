// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DateOnly, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import type { Rule } from './Rule.js';
import { compareValues } from './compareValues.js';

const empty = (value: unknown): boolean => value == null || value === '' || value === 0 || value === false ||
    Array.isArray(value) && !value.length || typeof value === 'string' && !value.trim() ||
    value instanceof Guid && (value as Guid).equals(Guid.empty);

function equal(left: unknown, right: unknown): boolean {
    if (left instanceof Guid && right instanceof Guid) return (left as Guid).equals(right);
    if (left instanceof DateOnly && right instanceof DateOnly) return (left as DateOnly).equals(right);
    if (left instanceof TimeOnly && right instanceof TimeOnly) return (left as TimeOnly).equals(right);
    if (left instanceof Date && right instanceof Date) return (left as Date).getTime() === (right as Date).getTime();
    if (left instanceof TimeSpan && right instanceof TimeSpan) return (left as TimeSpan).ticks === (right as TimeSpan).ticks;
    return left === right;
}

/** Evaluate one registered rule against its decoded (and concept-unwrapped) value. */
export async function evaluateRule(rule: Rule, value: unknown, model: unknown, signal: AbortSignal): Promise<boolean> {
    const [first, second] = rule.args;
    if (signal.aborted) throw signal.reason ?? new Error('Validation cancelled');
    switch (rule.kind) {
        case 'notNull': return value != null;
        case 'null': return value == null;
        case 'notEmpty': return !empty(value);
        case 'empty': return empty(value);
        case 'minLength': return value == null || typeof value === 'string' && value.length >= (first as number);
        case 'maxLength': return value == null || typeof value === 'string' && value.length <= (first as number);
        case 'length': return value == null || typeof value === 'string' &&
            value.length >= (first as number) && value.length <= (second as number);
        case 'greaterThan': return value == null || (compareValues(value, first) ?? -Infinity) > 0;
        case 'greaterThanOrEqual': return value == null || (compareValues(value, first) ?? -Infinity) >= 0;
        case 'lessThan': return value == null || (compareValues(value, first) ?? Infinity) < 0;
        case 'lessThanOrEqual': return value == null || (compareValues(value, first) ?? Infinity) <= 0;
        case 'inclusiveBetween': return value == null || (compareValues(value, first) ?? -Infinity) >= 0 &&
            (compareValues(value, second) ?? Infinity) <= 0;
        case 'exclusiveBetween': return value == null || (compareValues(value, first) ?? -Infinity) > 0 &&
            (compareValues(value, second) ?? Infinity) < 0;
        case 'equal': return equal(value, first);
        case 'notEqual': return !equal(value, first);
        case 'emailAddress': return value == null || typeof value === 'string' && /^[^@\s]+@[^@\s]+$/.test(value);
        case 'phone': return value == null || typeof value === 'string' && /^\+?[\d\s().-]{7,}$/.test(value);
        case 'url': return value == null || typeof value === 'string' && /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(value);
        case 'matches': return value == null || typeof value === 'string' &&
            new RegExp((first as RegExp).source, (first as RegExp).flags).test(value);
        case 'must': return (first as (value: unknown, model: unknown, signal: AbortSignal) => boolean)(value, model, signal);
        case 'mustAsync': return await (first as
            (value: unknown, model: unknown, signal: AbortSignal) => Promise<boolean>)(value, model, signal);
        default: throw new Error(`Unsupported validation rule: ${rule.kind}`);
    }
}
